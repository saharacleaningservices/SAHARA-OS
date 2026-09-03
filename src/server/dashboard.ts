import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    todaysLeadsCount,
    siteVisitsToday,
    activeJobsCount,
    pendingPaymentsAgg,
    staffAvailableCount,
    recentLeads,
    todaysJobs,
    overduePayments,
    followUpsToday,
    monthPayments,
    lastMonthPayments,
    monthExpenses,
    lastMonthExpenses,
  ] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    db.lead.count({ where: { stage: "SITE_VISIT", followUpDate: { gte: todayStart, lte: todayEnd } } }),
    db.job.count({ where: { status: { in: ["ASSIGNED", "ON_THE_WAY", "STARTED"] } } }),
    db.payment.aggregate({
      where: { status: { in: ["PENDING", "DUE_SOON", "OVERDUE"] } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    }),
    db.staff.count({ where: { isActive: true, availability: "AVAILABLE" } }),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.job.findMany({
      where: { scheduledDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledTime: "asc" },
      include: { supervisor: true },
      take: 8,
    }),
    db.payment.findMany({
      where: { status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    db.followUp.findMany({
      where: { isDone: false, dueDate: { gte: todayStart, lte: todayEnd } },
      include: { lead: true },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    db.payment.aggregate({
      where: { status: "PAID", paidDate: { gte: monthStart, lte: monthEnd } },
      _sum: { paidAmount: true },
    }),
    db.payment.aggregate({
      where: { status: "PAID", paidDate: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { paidAmount: true },
    }),
    db.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const monthlyRevenue = monthPayments._sum.paidAmount ?? 0;
  const lastMonthlyRevenue = lastMonthPayments._sum.paidAmount ?? 0;
  const monthlyExpenseTotal = monthExpenses._sum.amount ?? 0;
  const lastMonthlyExpenseTotal = lastMonthExpenses._sum.amount ?? 0;
  const netProfit = monthlyRevenue - monthlyExpenseTotal;
  const lastNetProfit = lastMonthlyRevenue - lastMonthlyExpenseTotal;

  const revenueTrend = lastMonthlyRevenue > 0 ? Math.round(((monthlyRevenue - lastMonthlyRevenue) / lastMonthlyRevenue) * 100) : 0;
  const profitTrend = lastNetProfit !== 0 ? Math.round(((netProfit - lastNetProfit) / Math.abs(lastNetProfit)) * 100) : 0;

  const pendingPaymentsTotal = (pendingPaymentsAgg._sum.amount ?? 0) - (pendingPaymentsAgg._sum.paidAmount ?? 0);

  return {
    stats: {
      todaysLeadsCount,
      siteVisitsToday,
      activeJobsCount,
      pendingPaymentsCount: pendingPaymentsAgg._count,
      pendingPaymentsTotal,
      monthlyRevenue,
      netProfit,
      staffAvailableCount,
      revenueTrend,
      profitTrend,
    },
    recentLeads,
    todaysJobs,
    overduePayments,
    followUpsToday,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
