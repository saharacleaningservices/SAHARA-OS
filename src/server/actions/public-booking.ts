"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { SERVICE_CATEGORY_TO_LEGACY } from "@/lib/constants";
import { z } from "zod";

const publicBookingSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  area: z.string().min(2, "Area is required"),
  address: z.string().optional().or(z.literal("")),
  serviceCategory: z.string().min(1, "Pick a service"),
  serviceVariant: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  mapLink: z.string().optional().or(z.literal("")),
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
      whatsapp: data.mobile,
      address: data.address || null,
      area: data.area,
      service: legacyService as never,
      serviceCategory: data.serviceCategory as never,
      serviceVariant: data.serviceVariant || null,
      source: "WEBSITE",
      notes: data.notes || null,
      mapLink: data.mapLink || null,
    },
  });

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: "Booked online via app.saharacleaningservices.com/book (unverified — no OTP yet)",
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, leadNumber };
}
