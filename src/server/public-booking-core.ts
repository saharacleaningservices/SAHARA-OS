// Public booking core (moved out of the "use server" action file 2026-10-22 so the REST layer
// src/app/api/public/v1/leads can call the SAME logic). The Server Action in actions/public-booking.ts is a thin
// wrapper that supplies the caller IP from the HTTP request. Behaviour is pinned by
// tests/public-booking-characterisation.test.ts.

import { sendEnquiryAck } from "@/server/enquiry-ack-email";
import { autoConfirmWebBooking } from "@/server/public-auto-confirm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { COMPANY, SERVICE_CATEGORY_TO_LEGACY, SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { recordUpsellEvent } from "@/server/upsell";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { slotLockKey, withSlotLock } from "@/lib/slot-lock";
import { getSlotAvailability } from "@/server/actions/slot-availability";
import { notify } from "@/server/notify";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { campaignOf, classifyTouch, sanitizeTouch } from "@/lib/attribution";
import { getPublicPricing } from "@/server/pricing";
import { FESTIVAL_PACKAGE_IDS, INSPECTION_ONLY_IDS, activeCampaign, festivalForDate, needsInspection, todayIST, unitPriceFor } from "@/lib/pricing-master";
import { scopeSnapshot } from "@/lib/service-scope";
import { publicPaymentState, resolvePublicEstimate } from "@/lib/booking-payment";
import { linkCustomerAndSite } from "@/server/customer-db";
import { copyLeadToSheet } from "@/server/lead-sheet";

/** Machine-readable reason added to every refusal (additive: the existing forms only read `error`). */
export type PublicBookingErrorCode = "VALIDATION" | "HONEYPOT" | "THROTTLED" | "SLOT_FULL" | "PACKAGE_UNAVAILABLE" | "FESTIVAL_DATE_REQUIRED";

const ONLINE_SOURCES = ["WEBSITE", "GMB", "FACEBOOK", "INSTAGRAM", "META", "GOOGLE"] as const;

const publicBookingSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  mobile: z
    .string()
    .max(20)
    .refine((v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, "").slice(-10)) && v.replace(/\D/g, "").length <= 12, "Enter a valid 10-digit mobile number"),
  alternateMobile: z.string().max(15).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").max(120).optional().or(z.literal("")),
  area: z.string().max(100).optional().or(z.literal("")),
  address: z.string().max(400).optional().or(z.literal("")),
  pinCode: z.string().max(10).optional().or(z.literal("")),
  serviceCategory: z.string().min(1, "Pick a service").max(60),
  serviceVariant: z.string().max(120).optional().or(z.literal("")),
  propertyType: z.string().max(60).optional().or(z.literal("")),
  packageName: z.string().max(120).optional().or(z.literal("")),
  comboServices: z.array(z.string().max(120)).max(30).optional(),
  addOnServices: z.array(z.string().max(120)).max(30).optional(),
  estimatedAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  advanceAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  paymentMode: z.enum(["UPI", "QR", "BANK", "CASH"]).optional(),
  advancePaid: z.boolean().optional(),
  serviceDate: z.string().max(40).optional().or(z.literal("")),
  timeSlot: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  mapLink: z.string().max(600).optional().or(z.literal("")),
  source: z.string().max(40).optional().or(z.literal("")),
  referralCode: z.string().max(40).optional().or(z.literal("")),
  bookingLinkToken: z.string().max(64).optional().or(z.literal("")),
  upsellRuleId: z.string().max(40).optional().or(z.literal("")),
  upsellLabel: z.string().max(120).optional().or(z.literal("")),
  upsellValue: z.coerce.number().min(0).max(10_000_000).optional(), // ignored server-side: the rule's own label/price are recorded
  upsellAccepted: z.boolean().optional(),
  // Website lead tag set by the WordPress server-side proxy (docs/website/wordpress-lead-proxy.php). Optional; unknown values are refused.
  leadTag: z.enum(["B2C_BOOKING", "B2B_COMMERCIAL_INSPECTION", "PROPERTY_SOLUTIONS"]).optional(),
  // Booking page v2: the customer's payment choice, and the quotation link
  // token when the booking comes from a quotation (/booking?quote=<token>).
  paymentPreference: z.enum(["PAY_ADVANCE", "PAY_AFTER_SERVICE"]).optional(),
  quotationToken: z.string().max(64).optional().or(z.literal("")),
  // Price snapshot from the booking wizard: the catalogue items picked. The
  // server re-prices them from live pricing (festival price when the service
  // date is inside a festival window) — the browser's total is never trusted.
  priceType: z.enum(["REGULAR", "FESTIVAL"]).optional(),
  selectedItems: z.array(z.object({ contentId: z.string().max(40), qty: z.number().int().min(1).max(100) })).max(30).optional(),
  // Explicit WhatsApp marketing opt-in ticked by the customer (never pre-ticked).
  marketingOptIn: z.boolean().optional(),
  // Honeypot — real visitors never fill this hidden field.
  // Accept any value here so the explicit check below (generic error) catches bots — zod's own message would reveal the trap.
  website: z.string().max(200).optional().or(z.literal("")),
  // First/latest-touch marketing attribution captured in the browser
  // (components/public/attribution-capture.tsx). Untrusted — sanitized below.
  attribution: z.unknown().optional(),
});

// Stages where an enquiry is still open — a new form submission from the
// same mobile updates that enquiry instead of creating a duplicate lead.
const OPEN_STAGES = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] as const;

/**
 * Public, unauthenticated booking form submission (Customer Form Link).
 * Creates a lead with source=WEBSITE. No OTP yet — the form notes it's
 * "unverified" in the timeline for staff follow-up (OTP is future-ready).
 */
async function publicBookLeadUnlocked(values: unknown, ctx: { ip: string | null }) {
  const parsed = publicBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again.", code: "VALIDATION" as PublicBookingErrorCode };
  }
  const data = parsed.data;
  if (data.website) return { error: "Something went wrong. Please try again.", code: "HONEYPOT" as PublicBookingErrorCode }; // honeypot tripped
  // Throttle spam: per IP and per mobile number (in-memory, single instance — see lib/rate-limit.ts).
  // Skipped when there is no HTTP request (internal/test calls).
  const ip = ctx.ip;
  if (ip) {
    const tail = data.mobile.replace(/\D/g, "").slice(-10);
    if (!rateLimit(`pubbook:ip:${ip}`, 10, 600).allowed || !rateLimit(`pubbook:mob:${tail}`, 5, 600).allowed) {
      return { error: "Too many requests — please wait a few minutes or call us to book.", code: "THROTTLED" as PublicBookingErrorCode };
    }
  }
  // Service date: a real calendar date, today or later (IST) — never trust the browser's picker.
  if (data.serviceDate) {
    const ymd = data.serviceDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Number.isNaN(new Date(`${ymd}T00:00:00+05:30`).getTime())) {
      return { error: "Please pick a valid service date.", code: "VALIDATION" as PublicBookingErrorCode };
    }
    if (ymd < todayIST()) return { error: "Please pick today or a future date.", code: "VALIDATION" as PublicBookingErrorCode };
  }

  // Re-check the requested slot on the server so a stale form can't request a
  // slot that filled up after the page loaded.
  if (data.serviceDate && data.timeSlot) {
    const avail = await getSlotAvailability(data.serviceDate.slice(0, 10)).catch(() => null);
    if (avail?.ok && avail.slots.some((x) => x.slot === data.timeSlot && !x.available)) {
      // A retry of this customer's own request (e.g. the response was lost on mobile
      // data) already holds that slot — it is counted against itself, so don't reject it.
      const tail = data.mobile.replace(/\D/g, "").slice(-10);
      const dayStart = new Date(`${data.serviceDate.slice(0, 10)}T00:00:00+05:30`);
      const ownHold = tail.length === 10
        ? await db.lead.findFirst({
            where: {
              deletedAt: null,
              timeSlot: data.timeSlot,
              serviceDate: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) },
              OR: [{ mobile: { endsWith: tail } }, { whatsapp: { endsWith: tail } }],
            },
            select: { id: true },
          })
        : null;
      if (!ownHold) return { error: "That time slot has just filled up — please pick another time or date.", code: "SLOT_FULL" as PublicBookingErrorCode };
    }
  }

  if (data.quotationToken) return bookFromQuotation(data);

  const legacyService = SERVICE_CATEGORY_TO_LEGACY[data.serviceCategory] ?? "HOME_DEEP_CLEANING";

  const attr = (data.attribution && typeof data.attribution === "object" ? data.attribution : {}) as Record<string, unknown>;
  const firstTouch = sanitizeTouch(attr.first);
  const latestTouch = sanitizeTouch(attr.latest) ?? firstTouch;
  const touchChannel = classifyTouch(firstTouch);
  // A friend's referral code is a real signal when nothing stronger exists.
  const channel = data.referralCode && (touchChannel === "Unattributed" || touchChannel === "Website Direct") ? "Referral" : touchChannel;
  const touchDate = (t: typeof firstTouch) => {
    const d = t?.at ? new Date(t.at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const latestFields = {
    latestTouchSource: latestTouch ? classifyTouch(latestTouch) : null,
    latestTouchMedium: latestTouch?.medium ?? null,
    latestTouchCampaign: campaignOf(latestTouch),
    latestTouchAt: touchDate(latestTouch),
  };
  // Set only when a lead has no attribution yet — never overwrites.
  const originalFields = {
    acquisitionChannel: channel,
    acquisitionCampaign: campaignOf(firstTouch),
    utmSource: firstTouch?.source ?? null,
    utmMedium: firstTouch?.medium ?? null,
    utmCampaign: firstTouch?.campaign ?? null,
    utmTerm: firstTouch?.term ?? null,
    utmContent: firstTouch?.content ?? null,
    gclid: firstTouch?.gclid ?? null,
    fbclid: firstTouch?.fbclid ?? null,
    landingPage: firstTouch?.landingPage ?? null,
    landingPageUrl: firstTouch?.landingPageUrl ?? null,
    firstTouchSource: firstTouch ? channel : null,
    firstTouchMedium: firstTouch?.medium ?? null,
    firstTouchCampaign: campaignOf(firstTouch),
    firstTouchAt: touchDate(firstTouch),
  };

  // One customer → many leads (owner rule 2026-10-08). The same enquiry is
  // updated, not duplicated: an open lead on this mobile for the SAME service
  // that has no service date yet (customer called, staff sent the form) or
  // the same service date (a repeat submission). A different service, or the
  // same service on another date, is a new enquiry with its own Lead ID —
  // linked to the same customer record below.
  const last10 = data.mobile.replace(/\D/g, "").slice(-10);
  const reqDay = data.serviceDate ? data.serviceDate.slice(0, 10) : null;
  const existingOpen = last10.length === 10
    ? ((await db.lead.findMany({
        where: {
          deletedAt: null,
          stage: { in: [...OPEN_STAGES] as never },
          service: legacyService as never,
          OR: [{ mobile: { endsWith: last10 } }, { whatsapp: { endsWith: last10 } }],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })).find((l) => !l.serviceDate || !reqDay || l.serviceDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === reqDay) ?? null)
    : null;
  const leadNumber = existingOpen?.leadNumber ?? (await generateLeadNumber());

  // Legacy LeadSource: the customer's own "how did you hear" answer wins,
  // otherwise it follows the detected acquisition channel.
  const CHANNEL_TO_LEGACY: Record<string, string> = {
    "Google Ads": "GOOGLE", "Google Organic/SEO": "GOOGLE", "Google Business Profile": "GMB", "Meta Ads": "META",
    "Instagram Organic": "INSTAGRAM", "Facebook Organic": "FACEBOOK", "WhatsApp Marketing": "WHATSAPP", "WhatsApp Direct": "WHATSAPP",
  };
  const source = (ONLINE_SOURCES as readonly string[]).includes((data.source || "").toUpperCase())
    ? (data.source as string).toUpperCase()
    : CHANNEL_TO_LEGACY[channel] ?? "WEBSITE";
  // Area column stays NOT NULL — keep it populated from PIN / first address line.
  const area =
    (data.area && data.area.trim()) ||
    data.pinCode ||
    (data.address ? data.address.split(/[\n,]/)[0]!.trim().slice(0, 60) : "") ||
    "—";
  const addOns = (data.addOnServices ?? []).filter(Boolean);
  const combos = (data.comboServices ?? []).filter(Boolean);

  // Repeat-customer detection — never blocks the booking; the app has no
  // separate Customer table (customers are grouped by mobile), so there is no
  // duplicate record to create. Flag it so the office sees the history.
  const priorLeads = await db.lead.count({ where: { mobile: data.mobile, deletedAt: null } });
  const priorJobs = await db.job.count({ where: { customerMobile: data.mobile, deletedAt: null } });
  const isRepeatCustomer = priorLeads + priorJobs > 0;

  // Server-side price snapshot for catalogue bookings (see selectedItems).
  // Only a server-priced catalogue total is authoritative. A browser-supplied
  // estimatedAmount is never stored as the quote — it becomes an unverified staff note.
  // 4 BHK and larger, villas, bungalows, full houses: staff inspect and quote — never an instant price.
  const inspectionRequired = data.serviceCategory === "HOME_DEEP_CLEANING" && needsInspection(data.propertyType);
  let estimated: number | null = null;
  let priceType: "REGULAR" | "FESTIVAL" | null = null;
  let festivalName: string | null = null;
  let scopeOfWork: string | null = null;
  if (data.selectedItems?.length) {
    const pricing = await getPublicPricing(); // painting stays unpriced for public requests (free site inspection first)
    const festival = data.serviceDate ? festivalForDate(pricing.festivals, data.serviceDate.slice(0, 10)) : null;
    const picked = data.selectedItems
      .map((s) => ({ s, item: pricing.items.find((p) => p.contentId === s.contentId) }))
      .filter((x): x is { s: { contentId: string; qty: number }; item: NonNullable<typeof x.item> } => !!x.item);
    if (picked.length !== data.selectedItems.length) return { error: "A selected package is no longer available — please refresh the page.", code: "PACKAGE_UNAVAILABLE" as PublicBookingErrorCode };
    // Festival campaign running: Premium/Platinum home packages are bookable only for festival service dates.
    // Pricing follows the service DATE, so a query parameter or edited form cannot select regular prices.
    const campaign = activeCampaign(pricing.festivals, todayIST());
    if (campaign && !festival && picked.some(({ item }) => FESTIVAL_PACKAGE_IDS.has(item.contentId))) {
      const d = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
      return { error: `Festival packages are available for service dates ${d(campaign.start)} – ${d(campaign.end)}. Please choose a date in the festival period.`, code: "FESTIVAL_DATE_REQUIRED" as PublicBookingErrorCode };
    }
    let total = 0;
    let allPriced = true;
    let usedFestival = false;
    for (const { s, item } of picked) {
      const unit = unitPriceFor(item, festival);
      if (unit == null) {
        allPriced = false;
        continue;
      }
      if (festival && festival.prices[item.contentId] != null) usedFestival = true;
      total += unit * Math.max(s.qty, item.minQty ?? 1);
    }
    if (total > 0) estimated = total;
    if (!allPriced && total === 0) estimated = null;
    priceType = usedFestival ? "FESTIVAL" : "REGULAR";
    festivalName = usedFestival ? festival!.name : null;
    // Inspection-only property (or an inspection-only package picked): no stored
    // price at all — an add-on subtotal must never stand in for the whole quote.
    if (inspectionRequired || picked.some(({ item }) => INSPECTION_ONLY_IDS.has(item.contentId))) {
      estimated = null;
      priceType = null;
      festivalName = null;
    }
    scopeOfWork = scopeSnapshot({
      packageName: data.packageName,
      serviceVariant: data.serviceVariant,
      items: picked.map(({ s, item }) => ({ name: item.name, qty: Math.max(s.qty, item.minQty ?? 1), unit: item.unit })),
    });
  }
  // No payment gateway exists: a public request can never mark anything paid.
  // Whatever advance the browser claims is kept only as an unverified staff note.
  const { advance, paymentStatus, declaredAdvance } = publicPaymentState({ advancePaid: data.advancePaid, advanceAmount: data.advanceAmount });
  const { unverifiedClientEstimate } = resolvePublicEstimate({ catalogueTotal: estimated, clientEstimate: data.estimatedAmount });

  // Package, property, price and scope are ONE unit: keep the open enquiry's
  // set if it has any of it, otherwise take the new submission's whole set —
  // never a package label from one submission with another's price.
  const keepPkg = existingOpen
    ? existingOpen.quoteAmount != null || !!existingOpen.packageName || !!existingOpen.scopeOfWork || !!existingOpen.propertyType || !!existingOpen.serviceVariant
    : false;
  const lead = existingOpen
    ? await db.lead.update({
        where: { id: existingOpen.id },
        data: {
          // Fill gaps only — never overwrite what staff already recorded.
          email: existingOpen.email ?? (data.email || null),
          address: existingOpen.address ?? (data.address || null),
          pinCode: existingOpen.pinCode ?? (data.pinCode || null),
          propertyType: keepPkg ? existingOpen.propertyType : data.propertyType || null,
          serviceVariant: keepPkg ? existingOpen.serviceVariant : data.serviceVariant || null,
          serviceDate: existingOpen.serviceDate ?? (data.serviceDate ? new Date(data.serviceDate) : null),
          timeSlot: existingOpen.timeSlot ?? (data.timeSlot || null),
          mapLink: existingOpen.mapLink ?? (data.mapLink || null),
          paymentPreference: data.paymentPreference ?? existingOpen.paymentPreference,
          quoteAmount: keepPkg ? existingOpen.quoteAmount : estimated,
          packageName: keepPkg ? existingOpen.packageName : data.packageName || null,
          priceType: keepPkg ? existingOpen.priceType : priceType,
          festivalName: keepPkg ? existingOpen.festivalName : festivalName,
          scopeOfWork: keepPkg ? existingOpen.scopeOfWork : scopeOfWork,
          ...(data.marketingOptIn ? { marketingConsent: "OPTED_IN", marketingConsentAt: new Date() } : {}),
          formSubmittedAt: new Date(),
          // A repeat submission without a tracked visit keeps the existing latest touch.
          ...(latestTouch ? latestFields : {}),
          ...(existingOpen.acquisitionChannel ? {} : originalFields),
        },
      })
    : await db.lead.create({
    data: {
      ...originalFields,
      ...latestFields,
      formSubmittedAt: new Date(),
      leadNumber,
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternateMobile || null,
      whatsapp: data.mobile,
      email: data.email || null,
      address: data.address || null,
      area,
      pinCode: data.pinCode || null,
      addOnServices: addOns.length ? JSON.stringify(addOns) : null,
      service: legacyService as never,
      serviceCategory: data.serviceCategory as never,
      serviceVariant: data.serviceVariant || null,
      propertyType: data.propertyType || null,
      packageName: data.packageName || null,
      comboServices: combos.length ? JSON.stringify(combos) : null,
      quoteAmount: estimated,
      priceType,
      festivalName,
      scopeOfWork,
      advanceAmount: advance || null,
      paymentMode: data.paymentMode || null,
      paymentStatus,
      serviceDate: data.serviceDate ? new Date(data.serviceDate) : null,
      timeSlot: data.timeSlot || null,
      source: source as never,
      notes: data.notes || null,
      mapLink: data.mapLink || null,
      referralCode: data.referralCode || null,
      paymentPreference: data.paymentPreference ?? null,
      ...(data.marketingOptIn ? { marketingConsent: "OPTED_IN", marketingConsentAt: new Date() } : {}),
    },
  });

  // One customer database: reuse the contact for this mobile (never a
  // duplicate) and the matching service site, or add the new address as a site.
  const link = await linkCustomerAndSite({
    mobile: data.mobile,
    name: data.name,
    alternateMobile: data.alternateMobile,
    email: data.email,
    address: data.address,
    pinCode: data.pinCode,
    area,
    mapLink: data.mapLink,
    source: "WEBSITE",
  });
  if (link?.siteId && !lead.siteId) {
    await db.lead.update({ where: { id: lead.id }, data: { siteId: link.siteId } }).catch(() => {});
  }

  // First email to the customer: a plain acknowledgement only (no quote, no invoice) — for a NEW enquiry, not a repeat submission.
  if (!existingOpen) void sendEnquiryAck(lead.id);

  // No Payment row is created here: a public request cannot prove a payment, so
  // nothing from this form is counted as collected revenue. Staff record any
  // real advance in the CRM (authenticated) after verifying it.

  // Automation: open a same-day high-priority call-back follow-up so the
  // enquiry can't be missed. Confirmation promised within 5–15 minutes.
  const followUpAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.followUp
    .create({
      data: {
        leadId: lead.id,
        dueDate: followUpAt,
        type: "CALL",
        priority: "HIGH",
        notes: inspectionRequired
          ? `New inspection / custom-quote request ${leadNumber} — call to arrange the site inspection (no price was shown).`
          : `New online booking ${leadNumber} — call to confirm schedule.`,
      },
    })
    .catch(() => {});

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: [
      existingOpen
        ? `Online form submitted for this existing enquiry (no duplicate lead created) via ${PUBLIC_BOOKING_URL.replace(/^https?:\/\//, "")}${latestTouch?.landingPage ?? "/book"}`
        : `Booked online (${source.toLowerCase()}) via ${PUBLIC_BOOKING_URL.replace(/^https?:\/\//, "")}${firstTouch?.landingPage ?? "/book"} (unverified — no OTP yet)`,
      `Attribution: ${existingOpen?.acquisitionChannel ?? channel}${campaignOf(firstTouch) ? ` / ${campaignOf(firstTouch)}` : ""}${latestTouch && latestFields.latestTouchSource !== channel ? ` · latest touch: ${latestFields.latestTouchSource}` : ""}`,
      isRepeatCustomer ? `⭐ Existing customer — ${priorLeads} prior enquir${priorLeads === 1 ? "y" : "ies"}, ${priorJobs} job(s) on this number` : null,
      data.leadTag ? `Lead tag: ${data.leadTag}` : null,
      data.propertyType ? `Property type: ${data.propertyType}` : null,
      data.marketingOptIn ? "WhatsApp marketing opt-in: ticked by the customer on the web booking form (optional, not pre-ticked)" : null,
      inspectionRequired ? `SITE INSPECTION REQUIRED — no price shown or charged; assess scope and prepare a custom quotation` : null,
      data.serviceDate ? `Requested service date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
      data.packageName ? `Package: ${data.packageName}` : null,
      combos.length ? `Combos: ${combos.join(", ")}` : null,
      addOns.length ? `Add-ons: ${addOns.join(", ")}` : null,
      estimated && !(existingOpen && keepPkg) ? `Estimated: ₹${estimated}` : null,
      unverifiedClientEstimate ? `Customer-side indicative estimate (UNVERIFIED, not a quote): ₹${unverifiedClientEstimate}` : null,
      declaredAdvance > 0 ? `Customer claims advance ₹${declaredAdvance} (${data.paymentMode ?? "—"}) — UNVERIFIED, pending staff verification` : `Advance: pending`,
      data.pinCode ? `PIN: ${data.pinCode}` : null,
      // A repeat submission keeps the lead's existing notes/selection — record what the customer sent now.
      existingOpen && keepPkg && (data.packageName || estimated) ? `Customer's new selection (lead price kept, review): ${data.packageName || data.serviceVariant || "—"}${estimated ? ` ₹${estimated}` : ""}` : null,
      existingOpen && data.notes ? `Customer notes: ${data.notes}` : null,
      data.alternateMobile ? `Alt mobile: ${data.alternateMobile}` : null,
      data.email ? `Email: ${data.email}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  if (data.upsellRuleId) {
    // Never trust the browser's label/price: record the active rule's own values.
    const rule = await db.upsellRule.findFirst({ where: { id: data.upsellRuleId, isActive: true } }).catch(() => null);
    if (rule) {
      await recordUpsellEvent({
        ruleId: rule.id,
        leadId: lead.id,
        label: rule.label,
        comboValue: rule.comboPrice ?? null,
        accepted: Boolean(data.upsellAccepted),
      }).catch(() => {});
    }
  }

  // Booking confirmation is normally sent when the enquiry is confirmed into
  // a job (see confirmBooking); this one acknowledges the request itself.
  // Queues safely when the WhatsApp Cloud API isn't connected yet.
  // This is a REQUEST acknowledgement, never a confirmation — the slot is
  // confirmed only when the office confirms the booking (confirmBooking /
  // manual job → src/server/booking-messages.ts). One acknowledgement per
  // lead per day, so a repeat submission doesn't message the customer again.
  // Instant confirmation (owner decision 30 Oct 2026): open slot + fixed-price service from the start date ->
  // scheduled Job + the standard booking confirmation WhatsApp (sent by the confirm core), so the "request
  // received" acknowledgement below is skipped. Anything else stays a request for the office, exactly as before.
  const auto = existingOpen?.stage === "JOB_SCHEDULED"
    ? ({ confirmed: false, reason: "already-scheduled" } as const)
    : await autoConfirmWebBooking(lead.id, { serviceDate: data.serviceDate, timeSlot: data.timeSlot, serviceCategory: data.serviceCategory, inspectionRequired });

  const svc = SERVICE_LABELS[legacyService] ?? legacyService;
  const ackedRecently = await db.whatsAppMessage.findFirst({
    where: { relatedType: "Lead", relatedId: lead.id, kind: "BOOKING_CONFIRMATION", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (ackedRecently || auto.confirmed) {
    // skip — already acknowledged, or confirmed (the booking confirmation was sent instead)
  } else if (process.env.WHATSAPP_USE_TEMPLATES === "on") {
    const t = templateByName("sahara_booking_request_received")!;
    const params = [data.name, leadNumber, svc, data.serviceDate || "your preferred date", data.timeSlot || "flexible time"];
    await sendWhatsAppTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: data.mobile,
      toName: data.name,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      preview: renderTemplatePreview(t, params),
      relatedType: "Lead",
      relatedId: lead.id,
    }).catch(() => {});
  } else await sendWhatsApp({
    kind: "BOOKING_CONFIRMATION",
    toNumber: data.mobile,
    toName: data.name,
    body: [
      `Hi ${data.name}, we have received your booking request with ${COMPANY.name}.`,
      `Our team will confirm the slot shortly — this is not yet a confirmed booking.`,
      ``,
      `Request ID: ${leadNumber}`,
      `Service: ${svc}${data.serviceVariant ? ` (${data.serviceVariant})` : ""}${data.packageName ? ` – ${data.packageName}` : ""}`,
      combos.length ? `Combos: ${combos.join(", ")}` : null,
      addOns.length ? `Add-ons: ${addOns.join(", ")}` : null,
      data.serviceDate ? `Preferred date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
      data.address ? `Address: ${data.address}${data.pinCode ? ` – ${data.pinCode}` : ""}` : null,
      ``,
      `Our team will call you shortly to confirm your slot.`,
      `Reach us on ${COMPANY.phones.join(" / ")}.`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    relatedType: "Lead",
    relatedId: lead.id,
  }).catch(() => {});

  // Real-time alert: loud notification + popup + vibration; tap opens the lead.
  await notify({
    kind: "NEW_BOOKING",
    title: `${auto.confirmed ? `Auto-confirmed ${auto.jobNumber} — assign crew` : "New booking"} — ${data.name}${isRepeatCustomer ? " (repeat customer)" : ""}`,
    body: [
      `${svc}${data.serviceVariant ? ` (${data.serviceVariant})` : ""}`,
      data.address || (data.pinCode ? `PIN ${data.pinCode}` : ""),
      data.serviceDate ? `${data.serviceDate} ${data.timeSlot || ""}`.trim() : "",
      `☎ ${data.mobile}`,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/leads/${lead.id}`,
    whatsappToAdmin: true,
    meta: { leadId: lead.id, leadNumber, source, ...(data.leadTag ? { leadTag: data.leadTag } : {}) },
  });

  // Close the loop on a personalized CRM link, if this booking came from one.
  if (data.bookingLinkToken) {
    await db.bookingLink
      .updateMany({
        where: { token: data.bookingLinkToken, submittedAt: null },
        data: { submittedAt: new Date(), leadId: lead.id },
      })
      .catch(() => {});
  }

  // Optional Google Sheet copy (off unless the owner set the webhook env vars).
  void copyLeadToSheet({
    timestamp: new Date().toISOString(),
    name: data.name,
    phone: data.mobile,
    locality: data.area || data.pinCode || "",
    service: svc,
    package: [data.propertyType, data.packageName || data.serviceVariant].filter(Boolean).join(" "),
    actual_price: estimated,
    page_source: latestTouch?.landingPage ?? firstTouch?.landingPage ?? "",
    utm_source: latestTouch?.source ?? firstTouch?.source ?? "",
    utm_campaign: latestTouch?.campaign ?? firstTouch?.campaign ?? "",
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return auto.confirmed
    ? { success: true as const, leadNumber, status: "CONFIRMED" as const, jobNumber: auto.jobNumber, bookingUrl: auto.bookingUrl }
    : { success: true as const, leadNumber, status: "PENDING" as const };
}

/**
 * Booking request from a quotation link (/booking?quote=<token>). The
 * quotation already fixes the customer, service and amount, so the customer
 * only picks date, slot and payment preference. Updates the quotation's own
 * lead (never creates a duplicate) and leaves it for the office to confirm.
 */
/** Public booking entry: bookings for the same service date run one at a time, so the capacity re-check and
 *  the lead insert are atomic per date (Diwali last-slot races) — different dates stay fully parallel. */
export async function publicBookLeadCore(values: unknown, ctx: { ip: string | null }) {
  const key = slotLockKey(values);
  return key ? withSlotLock(`book:${key}`, () => publicBookLeadUnlocked(values, ctx)) : publicBookLeadUnlocked(values, ctx);
}

async function bookFromQuotation(data: z.infer<typeof publicBookingSchema>) {
  const token = data.quotationToken ?? "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return { error: "This quotation link is not valid." };
  const quote = await db.quotation.findFirst({
    where: { publicToken: token },
    include: { lead: { select: { id: true, leadNumber: true, name: true, mobile: true, deletedAt: true, stage: true, jobs: { where: { deletedAt: null }, select: { jobNumber: true } } } } },
  });
  if (!quote || quote.lead.deletedAt) return { error: "This quotation link is not valid." };
  if (["REJECTED", "CANCELLED", "EXPIRED"].includes(quote.status)) return { error: "This quotation is no longer active — please contact us." };
  if (!data.serviceDate || !data.timeSlot) return { error: "Pick a date and an available time slot." };

  // Never let an old link silently rewrite a booked lead or re-apply a stale price:
  // an already-booked/closed enquiry, a superseded quotation or one past its
  // validity is recorded as a request for the office to reconfirm instead.
  const booked = quote.lead.jobs.length > 0 || ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED", "CANCELLED"].includes(quote.lead.stage);
  const newer = await db.quotation.findFirst({ where: { leadId: quote.leadId, createdAt: { gt: quote.createdAt }, status: { notIn: ["REJECTED", "CANCELLED", "EXPIRED"] } }, select: { quoteNumber: true } });
  const expired = !!quote.validTill && quote.validTill < new Date();
  const reconfirm = booked || !!newer || expired;
  const why = booked
    ? `enquiry already booked/closed${quote.lead.jobs[0] ? ` (job ${quote.lead.jobs[0].jobNumber})` : ""}`
    : newer
      ? `a newer quotation ${newer.quoteNumber} exists`
      : expired
        ? `quotation validity ended ${quote.validTill!.toLocaleDateString("en-IN")}`
        : "";

  const lead = reconfirm
    ? await db.lead.update({ where: { id: quote.leadId }, data: { formSubmittedAt: new Date() } })
    : await db.lead.update({
        where: { id: quote.leadId },
        data: {
          serviceDate: new Date(data.serviceDate),
          timeSlot: data.timeSlot,
          paymentPreference: data.paymentPreference ?? null,
          quoteAmount: quote.totalAmount,
          formSubmittedAt: new Date(),
        },
      });
  const pref = data.paymentPreference === "PAY_AFTER_SERVICE" ? "Pay after service" : "Pay advance";
  await addTimelineEntry({
    leadId: lead.id,
    type: "NOTE",
    body: reconfirm
      ? `Customer requested booking from quotation ${quote.quoteNumber} — ${data.serviceDate} at ${data.timeSlot} · ${pref}. NOT applied to the lead (${why}) — confirm date and price with the customer.`
      : `Customer requested booking from quotation ${quote.quoteNumber} — ${data.serviceDate} at ${data.timeSlot} · ${pref}. Awaiting office confirmation.`,
  }).catch(() => {});
  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "CALL", priority: "HIGH", notes: `Confirm booking request from quotation ${quote.quoteNumber}` } })
    .catch(() => {});
  await notify({
    kind: "NEW_BOOKING",
    title: `Booking request — ${quote.lead.name} (quotation ${quote.quoteNumber})`,
    body: `${data.serviceDate} ${data.timeSlot} · ${pref}`,
    href: `/leads/${lead.id}`,
  }).catch(() => {});

  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  return { success: true as const, leadNumber: quote.lead.leadNumber };
}
