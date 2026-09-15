import { db } from "@/lib/db";
import { getMonthlyLedgerForAllStaff } from "@/server/attendance";

// ─────────────────────────────────────────────────────────────────────────
// Phase B — Staff Performance Report. Combines the existing payroll/
// attendance ledger (getMonthlyLedgerForAllStaff — attendance, rewards,
// fines, earned wage, net balance, already fully built) with newly computed
// job/revenue/on-time figures from completed jobs for the same month.
//
// "On-time" is deliberately defined from data the schema already has: a
// completed job counts as on-time when Job.completedAt falls on the same
// calendar day as Job.scheduledDate. There is no separate "expected
// completion" field in the schema, so this is the most defensible
// heuristic without fabricating a new concept.
// ─────────────────────────────────────────────────────────────────────────

export type StaffPerformanceRow = {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  wageType: string;
  jobsCompleted: number;
  revenueGenerated: number;
  onTimePercent: number | null;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  offDays: number;
  advanceTotal: number;
  fineTotal: number;
  rewardTotal: number;
  earned: number;
  netBalance: number;
};

function sameCalendarDay(a: Date, b: Date): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * Full monthly performance report for every active staff member: jobs
 * completed, revenue generated, on-time %, attendance, rewards, fines and
 * pay — everything the Staff Performance Report / PDF / Excel export needs
 * in one call.
 */
export async function getStaffPerformanceReport(year: number, month: number): Promise<StaffPerformanceRow[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [ledgerRows, assignments] = await Promise.all([
    getMonthlyLedgerForAllStaff(year, month),
    db.jobAssignment.findMany({
      where: { job: { status: "COMPLETED", completedAt: { gte: start, lt: end } } },
      select: {
        staffId: true,
        job: { select: { jobValue: true, completedAt: true, scheduledDate: true } },
      },
    }),
  ]);

  const perf = new Map<string, { jobsCompleted: number; revenueGenerated: number; onTimeCount: number }>();
  for (const a of assignments) {
    const cur = perf.get(a.staffId) ?? { jobsCompleted: 0, revenueGenerated: 0, onTimeCount: 0 };
    cur.jobsCompleted += 1;
    cur.revenueGenerated += a.job.jobValue;
    if (a.job.completedAt && sameCalendarDay(a.job.completedAt, a.job.scheduledDate)) {
      cur.onTimeCount += 1;
    }
    perf.set(a.staffId, cur);
  }

  return ledgerRows.map((row) => {
    const p = perf.get(row.id) ?? { jobsCompleted: 0, revenueGenerated: 0, onTimeCount: 0 };
    const onTimePercent = p.jobsCompleted > 0 ? Math.round((p.onTimeCount / p.jobsCompleted) * 100) : null;
    return {
      ...row,
      jobsCompleted: p.jobsCompleted,
      revenueGenerated: p.revenueGenerated,
      onTimePercent,
    };
  });
}
