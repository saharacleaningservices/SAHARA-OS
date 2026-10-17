import { db } from "@/lib/db";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { jobScopeFor, type JobScope } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/session";

/** Resolves the logged-in user's own Staff record id, if they have one. */
export async function getOwnStaffId(userId: string): Promise<string | null> {
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } });
  return staff?.id ?? null;
}

/**
 * Date window (inclusive) a time-scoped role may see/act on; null = unrestricted.
 * One definition for the Jobs list, Job Detail, Dispatch, Dashboard and the
 * server actions, so the UI and the server-side block can never disagree.
 */
export function jobDateWindow(scope: JobScope, now = new Date()): { from: Date; to: Date } | null {
  if (scope === "YESTERDAY_TODAY_TOMORROW") return { from: startOfDay(addDays(now, -1)), to: endOfDay(addDays(now, 1)) };
  if (scope === "TODAY_TOMORROW" || scope === "OWN_TODAY_TOMORROW") return { from: startOfDay(now), to: endOfDay(addDays(now, 1)) };
  if (scope === "OWN_TODAY") return { from: startOfDay(now), to: endOfDay(now) };
  return null;
}

/** The window for a role (null = unrestricted). */
export function jobDateWindowForRole(role: string, now = new Date()) {
  return jobDateWindow(jobScopeFor(role), now);
}

/**
 * Job list, scoped per role:
 * - Operations (Francis): yesterday + today + tomorrow only
 * - Field Supervisor: jobs they supervise or are assigned to, AND only if
 *   scheduled today or tomorrow
 * - Worker: jobs they're assigned to, today only
 * - Admin / everyone else: unrestricted
 */
export async function getAllJobsForList(session?: SessionPayload) {
  const scope = jobScopeFor(session?.role ?? "ADMIN");
  const now = new Date();

  const where: Record<string, unknown> = { deletedAt: null };

  if (scope === "YESTERDAY_TODAY_TOMORROW" || scope === "TODAY_TOMORROW") {
    const w = jobDateWindow(scope, now)!;
    where.scheduledDate = { gte: w.from, lte: w.to };
  } else if (scope === "OWN_TODAY_TOMORROW" || scope === "OWN_TODAY") {
    const staffId = session ? await getOwnStaffId(session.sub) : null;
    where.OR = [{ supervisorId: staffId ?? "__none__" }, { assignments: { some: { staffId: staffId ?? "__none__" } } }];
    where.scheduledDate =
      scope === "OWN_TODAY"
        ? { gte: startOfDay(now), lte: endOfDay(now) }
        : { gte: startOfDay(now), lte: endOfDay(addDays(now, 1)) };
  }

  return db.job.findMany({
    where,
    // Strict date-wise, newest service date first (owner 2026-10-18); same date → newest Job ID first.
    orderBy: [{ scheduledDate: "desc" }, { jobNumber: "desc" }],
    include: {
      lead: { select: { leadNumber: true } },
      supervisor: { select: { name: true } },
      assignments: { include: { staff: { select: { name: true } } } },
      // Trashed (soft-deleted) payments never count as paid.
      payments: { where: { deletedAt: null }, select: { status: true, amount: true, paidAmount: true } },
      vehicle: { select: { name: true, plateNumber: true } },
    },
  });
}

/** Summary cards shown above the Jobs list. */
export async function getJobsPageStats(window: { from: Date; to: Date } | null = null) {
  const now = new Date();
  const inWindow = window ? { scheduledDate: { gte: window.from, lte: window.to } } : {};
  const [todayJobs, tomorrowJobs, pendingJobs, completedToday, pendingPaymentsAgg, yesterdayJobs] = await Promise.all([
    db.job.count({
      where: { deletedAt: null, status: { notIn: ["CANCELLED"] }, scheduledDate: { gte: startOfDay(now), lte: endOfDay(now) } },
    }),
    db.job.count({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED"] },
        scheduledDate: { gte: startOfDay(addDays(now, 1)), lte: endOfDay(addDays(now, 1)) },
      },
    }),
    db.job.count({ where: { deletedAt: null, status: "PENDING", ...inWindow } }),
    db.job.count({ where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: startOfDay(now), lte: endOfDay(now) }, ...inWindow } }),
    db.payment.aggregate({
      where: { deletedAt: null, status: { not: "PAID" }, jobId: { not: null } },
      _sum: { amount: true, paidAmount: true },
    }),
    db.job.count({
      where: { deletedAt: null, status: { notIn: ["CANCELLED"] }, scheduledDate: { gte: startOfDay(addDays(now, -1)), lte: endOfDay(addDays(now, -1)) } },
    }),
  ]);
  return {
    yesterdayJobs,
    todayJobs,
    tomorrowJobs,
    pendingJobs,
    completedToday,
    pendingPayments: (pendingPaymentsAgg._sum.amount ?? 0) - (pendingPaymentsAgg._sum.paidAmount ?? 0),
  };
}

/** Today's jobs grouped by area, for the Team Dispatch / route planner. */
export async function getTodayDispatch(dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const jobs = await db.job.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      scheduledDate: { gte: startOfDay(base), lte: endOfDay(base) },
    },
    orderBy: [{ area: "asc" }, { scheduledTime: "asc" }],
    include: {
      supervisor: { select: { name: true } },
      assignments: { include: { staff: { select: { name: true } } } },
      vehicle: { select: { name: true, plateNumber: true } },
    },
  });

  const groups = new Map<
    string,
    { area: string; jobs: typeof jobs }
  >();
  for (const j of jobs) {
    const key = j.area || "—";
    if (!groups.has(key)) groups.set(key, { area: key, jobs: [] });
    groups.get(key)!.jobs.push(j);
  }
  return { date: base, total: jobs.length, groups: [...groups.values()] };
}

export async function getJobDetail(id: string) {
  return db.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      // Latest quotation of the enquiry — the Job Status workspace shows its number/status.
      lead: { include: { quotations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, quoteNumber: true, status: true, totalAmount: true } } } },
      supervisor: true,
      vehicle: true,
      assignments: { include: { staff: true } },
      materialIssues: { orderBy: { issuedAt: "desc" } },
      certificate: true,
      payments: { where: { deletedAt: null } },
      invoice: true,
      // Expenses linked to this job (fuel, material, staff advance, vendor
      // payment, etc. tagged with jobId when recorded) — surfaced on the
      // Job Detail page so cost-per-job is visible without leaving the job.
      expenses: { where: { deletedAt: null }, orderBy: { date: "desc" } },
    },
  });
}

/** True if the given session is allowed to view/act on this specific job. */
export function canAccessJob(
  session: SessionPayload,
  job: { supervisorId: string | null; assignments: { staffId: string }[]; scheduledDate: Date },
  ownStaffId: string | null
): boolean {
  const scope = jobScopeFor(session.role);
  if (scope === "ALL") return true;
  const now = new Date();
  if (scope === "YESTERDAY_TODAY_TOMORROW" || scope === "TODAY_TOMORROW") {
    // Operations: yesterday/today/tomorrow; Field Coordinator: today/tomorrow — any team.
    const w = jobDateWindow(scope, now)!;
    return job.scheduledDate >= w.from && job.scheduledDate <= w.to;
  }
  if (!ownStaffId) return false;
  const isOwnJob = job.supervisorId === ownStaffId || job.assignments.some((a) => a.staffId === ownStaffId);
  if (!isOwnJob) return false;
  if (scope === "OWN_TODAY_TOMORROW" || scope === "OWN_TODAY") {
    const daysAhead = scope === "OWN_TODAY" ? 0 : 1;
    return job.scheduledDate >= startOfDay(now) && job.scheduledDate <= endOfDay(addDays(now, daysAhead));
  }
  return true;
}

/**
 * Lightweight job list for pickers — currently used by the "Link to Job"
 * selector on the Record an Expense dialog, so an expense (fuel, material,
 * staff advance, vendor payment...) can be tagged to the job it was spent
 * on. Ordered most-recent-first and capped so the dropdown stays fast on a
 * large job history.
 */
export async function getJobsForSelection() {
  return db.job.findMany({
    where: { deletedAt: null },
    orderBy: { scheduledDate: "desc" },
    take: 200,
    select: { id: true, jobNumber: true, customerName: true },
  });
}
