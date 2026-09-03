import { db } from "@/lib/db";
import { subDays, subMonths, startOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { LEAD_STAGES } from "@/lib/constants";

export async function getProfitData() {
  const now = new Date();

  // ── Daily revenue & expenses (last 30 days) ──────────────────────────
  const thirtyDaysAgo = startOfDay(subDays(now, 29));
  const [payments30, expenses30] = await Promise.all([
    db.payment.findMany({
      where: { status: "PAID", paidDate: { gte: thirtyDaysAgo } },
      select: { paidAmount: true, paidDate: true },
    }),
    db.expense.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { amount: true, date: true },
    }),
  ]);

  const dailyMap = new Map<string, { date: string; revenue: number; expenses: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = subDays(now, i);
    const key = format(d, "yyyy-MM-dd");
    dailyMap.set(key, { date: format(d, "d MMM"), revenue: 0, expenses: 0 });
  }
  for (const p of payments30) {
    if (!p.paidDate) continue;
    const key = format(p.paidDate, "yyyy-MM-dd");
    const entry = dailyMap.get(key);
    if (entry) entry.revenue += p.paidAmount;
  }
  for (const e of expenses30) {
    const key = format(e.date, "yyyy-MM-dd");
    const entry = dailyMap.get(key);
    if (entry) entry.expenses += e.amount;
  }
  const dailyRevenue = Array.from(dailyMap.values());

  // ── Monthly profit (last 6 months) ───────────────────────────────────
  const monthly: { month: string; revenue: number; expenses: number; profit: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const [rev, exp] = await Promise.all([
      db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: start, lte: end } }, _sum: { paidAmount: true } }),
      db.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }),
    ]);
    const revenue = rev._sum.paidAmount ?? 0;
    const expenses = exp._sum.amount ?? 0;
    monthly.push({ month: format(monthDate, "MMM yy"), revenue, expenses, profit: revenue - expenses });
  }

  // ── Lead conversion funnel ────────────────────────────────────────────
  const stageCounts = await Promise.all(LEAD_STAGES.map((stage) => db.lead.count({ where: { stage } })));
  const totalLeads = stageCounts.reduce((a, b) => a + b, 0);
  // Cumulative funnel: leads that have reached at least this stage or beyond
  const stageOrderIndex: Record<string, number> = Object.fromEntries(LEAD_STAGES.map((s, i) => [s, i]));
  const allLeadsStages = await db.lead.findMany({ select: { stage: true } });
  const funnel = LEAD_STAGES.map((stage) => ({
    stage,
    count: allLeadsStages.filter((l) => stageOrderIndex[l.stage] >= stageOrderIndex[stage]).length,
  }));
  const paidCount = stageCounts[LEAD_STAGES.indexOf("PAID")] ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((paidCount / totalLeads) * 1000) / 10 : 0;

  // ── Staff utilization ─────────────────────────────────────────────────
  const staffList = await db.staff.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      availability: true,
      jobAssignments: { where: { job: { scheduledDate: { gte: thirtyDaysAgo } } }, select: { id: true } },
    },
  });
  const utilizationByStaff = staffList
    .map((s) => ({ name: s.name.split(" ")[0], jobs: s.jobAssignments.length }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 8);

  const availabilityBreakdown = ["AVAILABLE", "ON_JOB", "ON_LEAVE", "OFF_DUTY"].map((status) => ({
    status,
    count: staffList.filter((s) => s.availability === status).length,
  }));

  return {
    dailyRevenue,
    monthly,
    funnel,
    totalLeads,
    conversionRate,
    utilizationByStaff,
    availabilityBreakdown,
  };
}

export type ProfitData = Awaited<ReturnType<typeof getProfitData>>;
