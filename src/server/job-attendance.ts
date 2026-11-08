import { db } from "@/lib/db";
import { istDayKey, istDayRange } from "@/lib/ist-days";
import { clearAttendanceForDate, dayKey, setAttendanceForDate } from "@/server/attendance";

/**
 * Job assignment → attendance (owner request 2026-11-08).
 *
 * Assigning staff to a confirmed job logs them PRESENT for the job's India-time day. The ledger is NOT written
 * separately: the Money Khata engine (server/staff-balance.ts) derives Salary Due from attendance.wageForDay, so one
 * attendance row IS the ledger update. A second StaffLedgerEntry would double-count the day.
 *
 * Rules
 *  - Only confirmed work counts: ASSIGNED / ON_THE_WAY / STARTED / COMPLETED / REACTIVATED. PENDING, POSTPONED and
 *    CANCELLED never log attendance.
 *  - Never overwrites a day that already has a row (an office-set Absent / Leave / Half Day wins).
 *  - Closed payroll months are refused (reported, not forced).
 *  - Future-dated jobs are logged on the job's own day: when the crew moves it ON_THE_WAY / STARTED / COMPLETED (or via
 *    the admin sweep), so Salary Due never counts days that have not happened yet.
 *  - One attendance row per staff per day, so two jobs on the same day pay one wage.
 *  - Rows created here carry method JOB_ASSIGN; only those are ever reversed (job cancelled / postponed / crew removed /
 *    rescheduled), and never when the person still has another confirmed job that day.
 */
export const AUTO_METHOD = "JOB_ASSIGN";
export const CONFIRMED_JOB_STATUSES = ["ASSIGNED", "ON_THE_WAY", "STARTED", "COMPLETED", "REACTIVATED"] as const;
const WORK_IN_PROGRESS = new Set(["ON_THE_WAY", "STARTED", "COMPLETED"]);

export type JobAttendanceDecision = "MARK" | "SKIP_STATUS" | "SKIP_FUTURE" | "SKIP_EXISTING";

/** Pure decision for one crew member on one job — unit-tested. */
export function decideJobAttendance(i: { jobStatus: string; jobDayIst: string; todayIst: string; hasExistingRow: boolean }): JobAttendanceDecision {
  if (!(CONFIRMED_JOB_STATUSES as readonly string[]).includes(i.jobStatus)) return "SKIP_STATUS";
  if (i.hasExistingRow) return "SKIP_EXISTING";
  if (i.jobDayIst > i.todayIst && !WORK_IN_PROGRESS.has(i.jobStatus)) return "SKIP_FUTURE";
  return "MARK";
}

export type JobAttendanceReport = { jobNumber: string; day: string; marked: string[]; skipped: { name: string; reason: string }[] };

export async function syncJobCrewAttendance(jobId: string, opts: { dryRun?: boolean } = {}): Promise<JobAttendanceReport | null> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      jobNumber: true, status: true, scheduledDate: true, deletedAt: true, isDemo: true,
      assignments: { select: { staffId: true, staff: { select: { name: true, isActive: true, deletedAt: true } } } },
    },
  });
  if (!job || job.deletedAt || job.isDemo || job.assignments.length === 0) return null;
  const day = istDayKey(job.scheduledDate);
  const today = istDayKey(new Date());
  const report: JobAttendanceReport = { jobNumber: job.jobNumber, day, marked: [], skipped: [] };

  for (const a of job.assignments) {
    const name = a.staff.name;
    if (!a.staff.isActive || a.staff.deletedAt) { report.skipped.push({ name, reason: "staff inactive" }); continue; }
    const existing = await db.attendance.findUnique({ where: { staffId_date: { staffId: a.staffId, date: dayKey(day) } }, select: { status: true } });
    const d = decideJobAttendance({ jobStatus: job.status, jobDayIst: day, todayIst: today, hasExistingRow: !!existing });
    if (d === "SKIP_EXISTING") { report.skipped.push({ name, reason: `already marked ${existing!.status}` }); continue; }
    if (d === "SKIP_FUTURE") { report.skipped.push({ name, reason: "future job — logged when work starts" }); continue; }
    if (d === "SKIP_STATUS") { report.skipped.push({ name, reason: `job status ${job.status}` }); continue; }
    if (opts.dryRun) { report.marked.push(name); continue; }
    const res = await setAttendanceForDate({ staffId: a.staffId, date: day, status: "PRESENT", actorName: `Auto: ${job.jobNumber}`, method: AUTO_METHOD, onlyIfUnmarked: true });
    if ("error" in res) report.skipped.push({ name, reason: String(res.error) });
    else if ("skipped" in res && res.skipped) report.skipped.push({ name, reason: "already marked" });
    else report.marked.push(name);
  }

  if (!opts.dryRun && (report.marked.length || report.skipped.some((s) => /closed/.test(s.reason)))) {
    const parts = [
      report.marked.length && `Attendance auto-logged Present for ${day}: ${report.marked.join(", ")}`,
      report.skipped.length && `not logged: ${report.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`,
    ].filter(Boolean);
    await db.activityLog.create({ data: { jobId, action: parts.join(" · ").slice(0, 500) } }).catch(() => {});
  }
  return report;
}

/** Undo auto-logged days (only JOB_ASSIGN rows, only when no other confirmed job keeps the person on that day). */
export async function reverseJobCrewAttendance(input: { staffIds: string[]; day: string; reason: string; actorName?: string }) {
  const range = istDayRange(`${input.day}T12:00:00+05:30`);
  const cleared: string[] = [];
  for (const staffId of new Set(input.staffIds)) {
    const row = await db.attendance.findUnique({ where: { staffId_date: { staffId, date: dayKey(input.day) } }, select: { method: true } });
    if (!row || row.method !== AUTO_METHOD) continue;
    const other = await db.jobAssignment.count({
      where: { staffId, job: { deletedAt: null, isDemo: false, status: { in: [...CONFIRMED_JOB_STATUSES] }, scheduledDate: { gte: range.from, lt: range.to } } },
    });
    if (other > 0) continue;
    const res = await clearAttendanceForDate({ staffId, date: input.day, actorName: input.actorName ?? "Auto (job change)", reason: input.reason });
    if ("success" in res) cleared.push(staffId);
  }
  return cleared;
}

/** Reverse for every crew member of a job (cancel / postpone). */
export async function reverseJobAttendanceForJob(jobId: string, reason: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { scheduledDate: true, assignments: { select: { staffId: true } } } });
  if (!job) return [];
  return reverseJobCrewAttendance({ staffIds: job.assignments.map((a) => a.staffId), day: istDayKey(job.scheduledDate), reason });
}
