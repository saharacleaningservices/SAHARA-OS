// Job crew helpers shared by the job actions and the Staff App:
//  - freezeJobTeam: snapshot the crew onto Job.teamSnapshot at completion so
//    history shows the team exactly as it was on that job.
//  - notifyCrew*: one Staff-App notification per real crew/date change.

import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { notifyStaff, dayHref } from "@/server/staff-notify";

export async function freezeJobTeam(jobId: string, opts: { force?: boolean } = {}) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      teamSnapshot: true,
      assignments: { select: { staffId: true, isLead: true, staff: { select: { name: true, employeeCode: true } } } },
    },
  });
  if (!job || (job.teamSnapshot && !opts.force)) return;
  const snapshot = job.assignments.map((a) => ({
    staffId: a.staffId,
    name: a.staff.name,
    employeeCode: a.staff.employeeCode,
    isLead: a.isLead,
  }));
  await db.job.update({ where: { id: jobId }, data: { teamSnapshot: JSON.stringify(snapshot) } });
}

/** Staff are told about a job only on its own day (no future-assignment alerts — owner rule 2026-10-05). */
function isTodayOrPast(d: Date) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return d <= end;
}

async function jobLabel(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { jobNumber: true, service: true, area: true, scheduledDate: true, scheduledTime: true },
  });
  if (!job) return null;
  const when = `${job.scheduledDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${job.scheduledTime}`;
  return { job, text: `${SERVICE_LABELS[job.service] ?? job.service} · ${job.area} · ${when}` };
}

/** New job assignment — only the staff newly added to the crew. */
export async function notifyCrewAssigned(jobId: string, staffIds: string[]) {
  if (staffIds.length === 0) return;
  const label = await jobLabel(jobId);
  if (!label || !isTodayOrPast(label.job.scheduledDate)) return;
  await notifyStaff(staffIds, {
    kind: "STAFF_JOB_ASSIGNED",
    title: `Today's job — ${label.job.jobNumber}`,
    body: label.text,
    href: `/my/jobs/${jobId}`,
    recordId: `${jobId}:assign:${Date.now()}`,
  });
}

/** Date/time or team change — staff who remain on the crew (removed staff get a separate "removed" notice). */
export async function notifyCrewChanged(jobId: string, staffIds: string[], what: string) {
  if (staffIds.length === 0) return;
  const label = await jobLabel(jobId);
  if (!label || !isTodayOrPast(label.job.scheduledDate)) return;
  await notifyStaff(staffIds, {
    kind: "STAFF_JOB_CHANGED",
    title: `Job updated — ${label.job.jobNumber}`,
    body: `${what}. ${label.text}`,
    href: dayHref(label.job.scheduledDate, `job-${jobId}`),
    recordId: `${jobId}:change:${Date.now()}`,
  });
}

export async function notifyCrewRemoved(jobId: string, staffIds: string[], previousDate: Date) {
  if (staffIds.length === 0) return;
  if (!isTodayOrPast(previousDate)) return;
  const label = await jobLabel(jobId);
  if (!label) return;
  await notifyStaff(staffIds, {
    kind: "STAFF_JOB_CHANGED",
    title: `Removed from job ${label.job.jobNumber}`,
    body: `You are no longer on this job (${previousDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}).`,
    href: dayHref(previousDate),
    recordId: `${jobId}:removed:${Date.now()}`,
  });
}
