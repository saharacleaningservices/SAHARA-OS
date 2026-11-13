"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { SERVICE_CATEGORY_TO_LEGACY, SERVICE_LABELS } from "@/lib/constants";
import { recordUpsellEvent } from "@/server/upsell";
import { sendWhatsApp } from "@/lib/whatsapp";
import { z } from "zod";
import { resolveZone, customerTypeFor, checkMinimumOrder, minimumOrderValue } from "@/lib/zones";

const publicBookingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  area: z.string().min(2, "Area is required"),
  address: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().min(1, "Pick a service"),
  serviceVariant: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  mapLink: z.string().optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode").optional().or(z.literal("")),
  // Cart / calculator total in ₹ (when the booking comes from a priced flow).
  estimatedTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  customerType: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  utmSource: z.string().max(200).optional().or(z.literal("")),
  utmMedium: z.string().max(200).optional().or(z.literal("")),
  utmCampaign: z.string().max(200).optional().or(z.literal("")),
  gclid: z.string().max(300).optional().or(z.literal("")),
  fbclid: z.string().max(300).optional().or(z.literal("")),
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

  // ── Zone routing + Minimum Order Value (enforced here, not just in the UI) ──
  const match = resolveZone({ area: data.area, address: data.address, pincode: data.pincode });
  const zoneId = match?.zone.id ?? null;
  const customerType = customerTypeFor(data.serviceCategory, data.customerType);
  const mov = minimumOrderValue(zoneId, customerType);
  if (match && data.estimatedTotal !== undefined) {
    const check = checkMinimumOrder({ zone: zoneId, customerType, total: data.estimatedTotal });
    if (!check.ok) return { error: check.message, minimumOrderValue: check.min };
  }
  // The plain /book form has no priced cart, so there is no total to check:
  // such leads are accepted but flagged for the team to confirm the MOV.
  const movPending = mov > 0 && data.estimatedTotal === undefined;

  const legacyService = SERVICE_CATEGORY_TO_LEGACY[data.serviceCategory] ?? "HOME_DEEP_CLEANING";
  const leadNumber = await generateLeadNumber();

  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: data.name,
      mobile: data.mobile,
      whatsapp: data.mobile,
      address: data.address || null,
      area: data.area,
      service: legacyService as never,
      serviceCategory: data.serviceCategory as never,
      serviceVariant: data.serviceVariant || null,
      source: "WEBSITE",
      notes: data.notes || null,
      mapLink: data.mapLink || null,
      referralCode: data.referralCode || null,
      zone: match?.zone.name ?? null,
      pincode: data.pincode || null,
      quoteAmount: data.estimatedTotal && data.estimatedTotal > 0 ? data.estimatedTotal : null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      gclid: data.gclid || null,
      fbclid: data.fbclid || null,
    },
  });

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: [
      "Booked online via app.saharacleaningservices.com/book (unverified — no OTP yet)",
      match ? `Zone: ${match.zone.name}${data.pincode ? ` · ${data.pincode}` : ""}` : "Zone: not recognised — confirm area manually",
      movPending ? `⚠ Minimum order value ₹${mov.toLocaleString("en-IN")} applies (${customerType.toLowerCase()}) — confirm the total before scheduling.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
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
  // a job (see confirmBooking); this early one acknowledges the request
  // itself, since a website enquiry has no scheduled slot yet.
  await sendWhatsApp({
    kind: "BOOKING_CONFIRMATION",
    toNumber: data.mobile,
    toName: data.name,
    body: `Hi ${data.name}, thanks for booking ${SERVICE_LABELS[legacyService] ?? legacyService} with us! Reference ${leadNumber}. Our team will call you shortly to confirm.`,
    relatedType: "Lead",
    relatedId: lead.id,
  }).catch(() => {});

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, leadNumber };
}
