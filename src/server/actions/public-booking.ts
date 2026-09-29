"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { COMPANY, SERVICE_CATEGORY_TO_LEGACY, SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { recordUpsellEvent } from "@/server/upsell";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { getSlotAvailability } from "@/server/actions/slot-availability";
import { notify } from "@/server/notify";
import { z } from "zod";
import { campaignOf, classifyTouch, sanitizeTouch } from "@/lib/attribution";

const ONLINE_SOURCES = ["WEBSITE", "GMB", "FACEBOOK", "INSTAGRAM", "META", "GOOGLE"] as const;

const publicBookingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  alternateMobile: z.string().max(15).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  area: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  pinCode: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().min(1, "Pick a service"),
  serviceVariant: z.string().optional().or(z.literal("")),
  propertyType: z.string().optional().or(z.literal("")),
  packageName: z.string().optional().or(z.literal("")),
  comboServices: z.array(z.string()).optional(),
  addOnServices: z.array(z.string()).optional(),
  estimatedAmount: z.coerce.number().min(0).optional(),
  advanceAmount: z.coerce.number().min(0).optional(),
  paymentMode: z.enum(["UPI", "QR", "BANK", "CASH"]).optional(),
  advancePaid: z.boolean().optional(),
  serviceDate: z.string().optional().or(z.literal("")),
  timeSlot: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  mapLink: z.string().optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
  bookingLinkToken: z.string().optional().or(z.literal("")),
  upsellRuleId: z.string().optional().or(z.literal("")),
  upsellLabel: z.string().optional().or(z.literal("")),
  upsellValue: z.coerce.number().optional(),
  upsellAccepted: z.boolean().optional(),
  // Booking page v2: the customer's payment choice, and the quotation link
  // token when the booking comes from a quotation (/booking?quote=<token>).
  paymentPreference: z.enum(["PAY_ADVANCE", "PAY_AFTER_SERVICE"]).optional(),
  quotationToken: z.string().max(64).optional().or(z.literal("")),
  // Honeypot — real visitors never fill this hidden field.
  website: z.string().max(0).optional().or(z.literal("")),
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
export async function publicBookLead(values: unknown) {
  const parsed = publicBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;
  if (data.website) return { error: "Something went wrong. Please try again." }; // honeypot tripped

  // Re-check the requested slot on the server so a stale form can't request a
  // slot that filled up after the page loaded.
  if (data.serviceDate && data.timeSlot) {
    const avail = await getSlotAvailability(data.serviceDate).catch(() => null);
    if (avail?.ok && avail.slots.some((x) => x.slot === data.timeSlot && !x.available)) {
      return { error: "That time slot has just filled up — please pick another time or date." };
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

  // Duplicate protection: an open enquiry on the same mobile (e.g. customer
  // called first, then staff sent them the form) is updated, not duplicated.
  const last10 = data.mobile.replace(/\D/g, "").slice(-10);
  const existingOpen = last10.length === 10
    ? await db.lead.findFirst({
        where: { deletedAt: null, stage: { in: [...OPEN_STAGES] as never }, OR: [{ mobile: { endsWith: last10 } }, { whatsapp: { endsWith: last10 } }] },
        orderBy: { createdAt: "desc" },
      })
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

  const estimated = data.estimatedAmount && data.estimatedAmount > 0 ? data.estimatedAmount : null;
  const advance = data.advancePaid && data.advanceAmount && data.advanceAmount > 0 ? data.advanceAmount : 0;
  const paymentStatus = advance > 0
    ? estimated && advance >= estimated
      ? "PAID"
      : "PARTIAL"
    : "PENDING_ADVANCE";

  const lead = existingOpen
    ? await db.lead.update({
        where: { id: existingOpen.id },
        data: {
          // Fill gaps only — never overwrite what staff already recorded.
          email: existingOpen.email ?? (data.email || null),
          address: existingOpen.address ?? (data.address || null),
          pinCode: existingOpen.pinCode ?? (data.pinCode || null),
          propertyType: existingOpen.propertyType ?? (data.propertyType || null),
          serviceVariant: existingOpen.serviceVariant ?? (data.serviceVariant || null),
          serviceDate: existingOpen.serviceDate ?? (data.serviceDate ? new Date(data.serviceDate) : null),
          timeSlot: existingOpen.timeSlot ?? (data.timeSlot || null),
          mapLink: existingOpen.mapLink ?? (data.mapLink || null),
          paymentPreference: data.paymentPreference ?? existingOpen.paymentPreference,
          formSubmittedAt: new Date(),
          ...latestFields,
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
    },
  });

  // Customer-declared advance → a Payment row so it flows into the Payments
  // module + revenue (marked from the booking form, unverified like the
  // booking itself until the office confirms the screenshot).
  if (advance > 0) {
    const { generateInvoiceNumber } = await import("@/lib/id-generators");
    const total = estimated ?? advance;
    const dueDate = data.serviceDate ? new Date(data.serviceDate) : new Date(Date.now() + 7 * 86400000);
    await db.payment
      .create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          leadId: lead.id,
          clientName: data.name,
          clientMobile: data.mobile,
          amount: total,
          paidAmount: advance,
          dueDate,
          paidDate: new Date(),
          status: advance >= total ? "PAID" : "PENDING",
          mode: data.paymentMode || null,
          notes: `Advance declared on the online booking form (${data.paymentMode ?? "—"})`,
        },
      })
      .catch(() => {});
  }

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
        notes: `New online booking ${leadNumber} — call to confirm schedule.`,
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
      data.propertyType ? `Property type: ${data.propertyType}` : null,
      data.serviceDate ? `Requested service date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
      data.packageName ? `Package: ${data.packageName}` : null,
      combos.length ? `Combos: ${combos.join(", ")}` : null,
      addOns.length ? `Add-ons: ${addOns.join(", ")}` : null,
      estimated ? `Estimated: ₹${estimated}` : null,
      advance > 0 ? `Advance declared: ₹${advance} (${data.paymentMode ?? "—"})` : `Advance: pending`,
      data.pinCode ? `PIN: ${data.pinCode}` : null,
      data.alternateMobile ? `Alt mobile: ${data.alternateMobile}` : null,
      data.email ? `Email: ${data.email}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  if (data.upsellRuleId) {
    await recordUpsellEvent({
      ruleId: data.upsellRuleId,
      leadId: lead.id,
      label: data.upsellLabel || "Combo offer",
      comboValue: data.upsellValue || null,
      accepted: Boolean(data.upsellAccepted),
    }).catch(() => {});
  }

  // Booking confirmation is normally sent when the enquiry is confirmed into
  // a job (see confirmBooking); this one acknowledges the request itself.
  // Queues safely when the WhatsApp Cloud API isn't connected yet.
  // This is a REQUEST acknowledgement, never a confirmation — the slot is
  // confirmed only when the office confirms the booking (confirmBooking /
  // manual job → src/server/booking-messages.ts). One acknowledgement per
  // lead per day, so a repeat submission doesn't message the customer again.
  const svc = SERVICE_LABELS[legacyService] ?? legacyService;
  const ackedRecently = await db.whatsAppMessage.findFirst({
    where: { relatedType: "Lead", relatedId: lead.id, kind: "BOOKING_CONFIRMATION", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (ackedRecently) {
    // skip — already acknowledged
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
    title: `New booking — ${data.name}${isRepeatCustomer ? " (repeat customer)" : ""}`,
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
    meta: { leadId: lead.id, leadNumber, source },
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

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, leadNumber };
}

/**
 * Booking request from a quotation link (/booking?quote=<token>). The
 * quotation already fixes the customer, service and amount, so the customer
 * only picks date, slot and payment preference. Updates the quotation's own
 * lead (never creates a duplicate) and leaves it for the office to confirm.
 */
async function bookFromQuotation(data: z.infer<typeof publicBookingSchema>) {
  const token = data.quotationToken ?? "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return { error: "This quotation link is not valid." };
  const quote = await db.quotation.findFirst({
    where: { publicToken: token },
    include: { lead: { select: { id: true, leadNumber: true, name: true, mobile: true, deletedAt: true } } },
  });
  if (!quote || quote.lead.deletedAt) return { error: "This quotation link is not valid." };
  if (["REJECTED", "CANCELLED", "EXPIRED"].includes(quote.status)) return { error: "This quotation is no longer active — please contact us." };
  if (!data.serviceDate || !data.timeSlot) return { error: "Pick a date and an available time slot." };

  const lead = await db.lead.update({
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
    body: `Customer requested booking from quotation ${quote.quoteNumber} — ${data.serviceDate} at ${data.timeSlot} · ${pref}. Awaiting office confirmation.`,
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
