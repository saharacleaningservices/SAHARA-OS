"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { COMPANY, SERVICE_CATEGORY_TO_LEGACY, SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { recordUpsellEvent } from "@/server/upsell";
import { sendWhatsApp } from "@/lib/whatsapp";
import { notify } from "@/server/notify";
import { z } from "zod";

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
  // Honeypot — real visitors never fill this hidden field.
  website: z.string().max(0).optional().or(z.literal("")),
});

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

  const legacyService = SERVICE_CATEGORY_TO_LEGACY[data.serviceCategory] ?? "HOME_DEEP_CLEANING";
  const leadNumber = await generateLeadNumber();

  const source = (ONLINE_SOURCES as readonly string[]).includes((data.source || "").toUpperCase())
    ? (data.source as string).toUpperCase()
    : "WEBSITE";
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

  const lead = await db.lead.create({
    data: {
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
      `Booked online (${source.toLowerCase()}) via ${PUBLIC_BOOKING_URL.replace(/^https?:\/\//, "")}/book (unverified — no OTP yet)`,
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
  const svc = SERVICE_LABELS[legacyService] ?? legacyService;
  await sendWhatsApp({
    kind: "BOOKING_CONFIRMATION",
    toNumber: data.mobile,
    toName: data.name,
    body: [
      `Hi ${data.name}, thank you for booking with ${COMPANY.name}! ✅`,
      ``,
      `Booking ID: ${leadNumber}`,
      `Service: ${svc}${data.serviceVariant ? ` (${data.serviceVariant})` : ""}${data.packageName ? ` – ${data.packageName}` : ""}`,
      combos.length ? `Combos: ${combos.join(", ")}` : null,
      addOns.length ? `Add-ons: ${addOns.join(", ")}` : null,
      data.serviceDate ? `Preferred date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
      data.address ? `Address: ${data.address}${data.pinCode ? ` – ${data.pinCode}` : ""}` : null,
      ``,
      `Our team will call you shortly to confirm the schedule.`,
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
