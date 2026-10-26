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
/** @deprecated single-job mapping kept for reference; syncLeadFromJob aggregates all jobs. */
export function leadStageForJobStatus(status: string): "JOB_SCHEDULED" | "COMPLETED" | "CANCELLED" {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "JOB_SCHEDULED";
}

/**
 * Mirror the job(s) onto the enquiry. An enquiry can have more than one job
 * (e.g. a second service added from Jobs → New Job), so:
 *   stage = Job Scheduled while ANY job is still active; otherwise Completed if
 *           any job was completed, else Cancelled;
 *   date  = the only job's date/slot, or with several jobs the earliest
 *           still-active job (left unchanged when none is active).
 */
export async function syncLeadFromJob(jobId: string, authorId?: string | null) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { leadId: true, jobNumber: true, status: true } });
  if (!job?.leadId) return;
  const [lead, jobs] = await Promise.all([
    db.lead.findUnique({ where: { id: job.leadId }, select: { stage: true, serviceDate: true, followUpDate: true, timeSlot: true } }),
    db.job.findMany({ where: { leadId: job.leadId, deletedAt: null }, orderBy: { scheduledDate: "asc" }, select: { status: true, scheduledDate: true, scheduledTime: true } }),
  ]);
  if (!lead || jobs.length === 0) return;
  const active = jobs.filter((j) => j.status !== "COMPLETED" && j.status !== "CANCELLED");
  const stage: "JOB_SCHEDULED" | "COMPLETED" | "CANCELLED" = active.length ? "JOB_SCHEDULED" : jobs.some((j) => j.status === "COMPLETED") ? "COMPLETED" : "CANCELLED";
  const mirror = jobs.length === 1 ? jobs[0] : active[0];
  // serviceDate and followUpDate are checked independently: a lead edit can move
  // serviceDate with the job while re-saving a stale follow-up date from the form.
  const data = {
    ...(mirror && lead.serviceDate?.getTime() !== mirror.scheduledDate.getTime() && { serviceDate: mirror.scheduledDate }),
    ...(mirror && lead.followUpDate?.getTime() !== mirror.scheduledDate.getTime() && { followUpDate: mirror.scheduledDate }),
    ...(mirror && lead.timeSlot !== mirror.scheduledTime && { timeSlot: mirror.scheduledTime }),
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
  const jobs = await db.job.findMany({
    where: { leadId, deletedAt: null },
    select: { id: true, jobNumber: true, status: true, scheduledDate: true, scheduledTime: true, assignments: { select: { staffId: true } } },
  });
  // Only an enquiry with exactly ONE job is rescheduled from the enquiry side;
  // with several jobs the office reschedules each job on its own page.
  if (jobs.length !== 1) return null;
  const j = jobs[0];
  return j.status === "CANCELLED" || j.status === "COMPLETED" ? null : j;
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
