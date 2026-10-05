// Single source of truth for the Lead ↔ Job lifecycle sync (server-only).
//
//   New Lead → Booking Confirmed (confirmBooking creates exactly ONE job)
//   → Scheduled → Work Started → Completed     (job status drives the lead stage)
//   Reschedule: the JOB's date/time is the schedule; the linked lead mirrors it
//   (service date / slot / follow-up) so dashboards, Francis's today/tomorrow
//   access, the calendar views and staff notifications all agree.
//
// Every function is idempotent: an unchanged value is a no-op (no duplicate
// timeline entries, activity logs or notifications).

import { db } from "@/lib/db";
import { notifyCrewChanged } from "@/server/job-team";
import { sendBookingChangeNotice } from "@/server/booking-messages";
import { addTimelineEntry } from "@/server/timeline";

/** Job status → lead stage. On the Way / Started keep the lead at "Job Scheduled". */
export function leadStageForJobStatus(status: string): "JOB_SCHEDULED" | "COMPLETED" | "CANCELLED" {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "JOB_SCHEDULED";
}

/** Mirror the job's schedule + status onto its enquiry (if any). */
export async function syncLeadFromJob(jobId: string, authorId?: string | null) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { leadId: true, jobNumber: true, status: true, scheduledDate: true, scheduledTime: true } });
  if (!job?.leadId) return;
  const lead = await db.lead.findUnique({ where: { id: job.leadId }, select: { stage: true, serviceDate: true, timeSlot: true, followUpDate: true } });
  if (!lead) return;
  const stage = leadStageForJobStatus(job.status);
  const sameDate = lead.serviceDate?.getTime() === job.scheduledDate.getTime();
  const data = {
    ...(!sameDate && { serviceDate: job.scheduledDate, followUpDate: job.scheduledDate }),
    ...(lead.timeSlot !== job.scheduledTime && { timeSlot: job.scheduledTime }),
    ...(lead.stage !== stage && { stage }),
  };
  if (Object.keys(data).length === 0) return;
  await db.lead.update({ where: { id: job.leadId }, data });
  if (lead.stage !== stage) {
    await addTimelineEntry({
      leadId: job.leadId,
      type: "STAGE",
      body: `Stage → ${stage === "JOB_SCHEDULED" ? "Job Scheduled" : stage === "COMPLETED" ? "Completed" : "Cancelled"} (job ${job.jobNumber} ${job.status.replaceAll("_", " ").toLowerCase()})`,
      meta: { fromStage: lead.stage, toStage: stage, jobId },
      authorId: authorId ?? null,
    }).catch(() => {});
  }
}

/** The enquiry's active job (not deleted, not cancelled/completed), if any. */
export async function activeJobForLead(leadId: string) {
  return db.job.findFirst({
    where: { leadId, deletedAt: null, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    select: { id: true, jobNumber: true, status: true, scheduledDate: true, scheduledTime: true, assignments: { select: { staffId: true } } },
  });
}

/**
 * Reschedule a job from the ENQUIRY side (office edits the lead's service date/slot).
 * Applies to the job so schedule, calendar, customer notice and crew stay in sync.
 */
export async function rescheduleJobFromLead(leadId: string, date: Date | null, slot: string | null, actorId?: string | null) {
  const job = await activeJobForLead(leadId);
  if (!job) return null;
  const nextDate = date ?? job.scheduledDate;
  const nextSlot = slot || job.scheduledTime;
  if (nextDate.getTime() === job.scheduledDate.getTime() && nextSlot === job.scheduledTime) return null;
  await db.job.update({ where: { id: job.id }, data: { scheduledDate: nextDate, scheduledTime: nextSlot } });
  await db.activityLog.create({ data: { jobId: job.id, actorId: actorId ?? null, action: `Rescheduled from enquiry to ${nextDate.toLocaleDateString("en-IN")} ${nextSlot}` } });
  await sendBookingChangeNotice(job.id, "RESCHEDULED").catch(() => {});
  await notifyCrewChanged(job.id, job.assignments.map((a) => a.staffId), "Date/time changed").catch(() => {});
  return job.id;
}
