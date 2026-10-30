import { db } from "@/lib/db";
import { autoConfirmEligible, type AutoConfirmResult } from "@/lib/auto-confirm-rule";
import { confirmLeadIntoJob } from "@/server/confirm-lead-core";
import { addTimelineEntry } from "@/server/timeline";
import { bookingPageUrl, ensureJobToken } from "@/server/booking-messages";

// Instant confirmation of website bookings (owner decision 30 Oct 2026): from AUTO_CONFIRM_FROM onwards, a fixed-price
// booking with a real, available arrival window is turned into a scheduled Job straight away - the same path as the
// office's "Confirm Booking" (server/confirm-lead-core.ts), so the customer gets the standard WhatsApp booking
// confirmation with the booking page link (status: confirmed -> crew assigned -> started -> completed).
// Inspection / custom-quote work (painting, commercial, housekeeping, 4 BHK+) is never auto-confirmed.
//   PUBLIC_AUTO_CONFIRM=off            kill switch (back to "request received" + office confirmation)
//   PUBLIC_AUTO_CONFIRM_FROM=YYYY-MM-DD first service date that is auto-confirmed (default 2026-11-06)

/**
 * Confirms the website booking into a Job. Never throws: on any problem the enquiry simply stays open for the office
 * (the existing "request received" flow), so a failure here can never lose a lead.
 */
export async function autoConfirmWebBooking(
  leadId: string,
  input: { serviceDate?: string | null; timeSlot?: string | null; serviceCategory?: string | null; inspectionRequired: boolean },
): Promise<AutoConfirmResult> {
  const rule = autoConfirmEligible(input);
  if (!rule.ok) return { confirmed: false, reason: rule.reason };
  try {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.deletedAt) return { confirmed: false, reason: "lead-missing" };
    const res = await confirmLeadIntoJob(lead, { serviceDate: input.serviceDate!.slice(0, 10), timeSlot: input.timeSlot!, supervisorId: "" });
    if (!res.success) return { confirmed: false, reason: res.error ?? "confirm-failed" };
    const job = await db.job.findUnique({ where: { id: res.jobId }, select: { jobNumber: true } });
    const token = await ensureJobToken(res.jobId).catch(() => null);
    await addTimelineEntry({ leadId, type: "SYSTEM", body: `Auto-confirmed from the website (open slot ${input.serviceDate!.slice(0, 10)} ${input.timeSlot}) - assign the crew.` }).catch(() => {});
    return { confirmed: true, jobId: res.jobId, jobNumber: job?.jobNumber ?? "", bookingUrl: token ? bookingPageUrl(token) : null };
  } catch (e) {
    console.error("[auto-confirm] failed, left for the office:", e);
    return { confirmed: false, reason: "error" };
  }
}
