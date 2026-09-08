"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { COMPANY, SERVICE_CATEGORY_TO_LEGACY, SERVICE_LABELS } from "@/lib/constants";
import { recordUpsellEvent } from "@/server/upsell";
import { sendWhatsApp } from "@/lib/whatsapp";
import { z } from "zod";

const publicBookingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  alternateMobile: z.string().max(15).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  area: z.string().min(2, "Area is required"),
  address: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().min(1, "Pick a service"),
  serviceVariant: z.string().optional().or(z.literal("")),
  serviceDate: z.string().optional().or(z.literal("")),
  timeSlot: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  mapLink: z.string().optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
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

  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternateMobile || null,
      whatsapp: data.mobile,
      email: data.email || null,
      address: data.address || null,
      area: data.area,
      service: legacyService as never,
      serviceCategory: data.serviceCategory as never,
      serviceVariant: data.serviceVariant || null,
      serviceDate: data.serviceDate ? new Date(data.serviceDate) : null,
      timeSlot: data.timeSlot || null,
      source: "WEBSITE",
      notes: data.notes || null,
      mapLink: data.mapLink || null,
      referralCode: data.referralCode || null,
    },
  });

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: [
      "Booked online via app.saharacleaningservices.com/book (unverified — no OTP yet)",
      data.serviceDate ? `Requested service date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
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
      `Service: ${svc}${data.serviceVariant ? ` (${data.serviceVariant})` : ""}`,
      data.serviceDate ? `Preferred date: ${data.serviceDate}` : null,
      data.timeSlot ? `Preferred slot: ${data.timeSlot}` : null,
      data.address || data.area ? `Address: ${data.address || data.area}` : null,
      ``,
      `Our team will call you shortly to confirm the schedule.`,
      `Reach us on ${COMPANY.phones.join(" / ")}.`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    relatedType: "Lead",
    relatedId: lead.id,
  }).catch(() => {});

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, leadNumber };
}
