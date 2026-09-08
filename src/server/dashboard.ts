import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";

export async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekAheadEnd = endOfDay(addDays(now, 7));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    todaysLeadsCount,
    totalLeadsCount,
    monthlyLeadsCount,
    siteVisitsToday,
    activeJobsCount,
    upcomingJobsCount,
    monthlyBookingsCount,
    todaysJobsCount,
    tomorrowsJobsCount,
    pendingPaymentsAgg,
    pendingAdvanceAgg,
    collectionsTodayAgg,
    staffAvailableCount,
    staffOnJobCount,
    vehiclesActiveCount,
    upcomingAmcCount,
    pendingFollowUpsCount,
    completed30Count,
    reviews30Count,
    recentLeads,
    todaysJobs,
    overduePayments,
    followUpsToday,
    followUpsTomorrow,
    followUpsOverdue,
    monthPayments,
    lastMonthPayments,
    monthExpenses,
    lastMonthExpenses,
  ] = await Promise.all([
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: todayStart, lte: todayEnd } } }),
    db.lead.count({ where: { deletedAt: null } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: monthStart, lte: monthEnd } } }),
    db.lead.count({ where: { deletedAt: null, stage: "SITE_VISIT", followUpDate: { gte: todayStart, lte: todayEnd } } }),
    db.job.count({ where: { deletedAt: null, status: { in: ["ASSIGNED", "ON_THE_WAY", "STARTED"] } } }),
    db.job.count({ where: { deletedAt: null, status: { not: "COMPLETED" }, scheduledDate: { gt: todayEnd } } }),
    db.job.count({ where: { deletedAt: null, createdAt: { gte: monthStart, lte: monthEnd } } }),
    db.job.count({ where: { deletedAt: null, scheduledDate: { gte: todayStart, lte: todayEnd } } }),
    db.job.count({ where: { deletedAt: null, scheduledDate: { gte: tomorrowStart, lte: tomorrowEnd } } }),
    db.payment.aggregate({
      where: { deletedAt: null, status: { in: ["PENDING", "DUE_SOON", "OVERDUE"] } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { deletedAt: null, status: "PENDING", paidAmount: { lte: 0 } },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { deletedAt: null, paidDate: { gte: todayStart, lte: todayEnd } },
      _sum: { paidAmount: true },
      _count: true,
    }),
    db.staff.count({ where: { deletedAt: null, isActive: true, availability: "AVAILABLE" } }),
    db.staff.count({ where: { deletedAt: null, isActive: true, availability: "ON_JOB" } }),
    db.vehicle.count({ where: { isActive: true } }),
    db.amcContract.count({
      where: { deletedAt: null, status: "ACTIVE", nextVisitDate: { gte: todayStart, lte: weekAheadEnd } },
    }),
    db.followUp.count({ where: { isDone: false, dueDate: { lte: todayEnd }, lead: { deletedAt: null } } }),
    db.job.count({ where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: subMonths(now, 1) } } }),
    db.review.count({ where: { createdAt: { gte: subMonths(now, 1) } } }),
    db.lead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.job.findMany({
      where: { deletedAt: null, scheduledDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledTime: "asc" },
      include: { supervisor: true },
      take: 8,
    }),
    db.payment.findMany({
      where: { deletedAt: null, status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    db.followUp.findMany({
      where: { isDone: false, dueDate: { gte: todayStart, lte: todayEnd }, lead: { deletedAt: null } },
      include: { lead: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.followUp.findMany({
      where: { isDone: false, dueDate: { gte: tomorrowStart, lte: tomorrowEnd }, lead: { deletedAt: null } },
      include: { lead: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.followUp.findMany({
      where: { isDone: false, dueDate: { lt: todayStart }, lead: { deletedAt: null } },
      include: { lead: true },
      orderBy: { dueDate: "asc" },
      take: 12,
    }),
    db.payment.aggregate({
      where: { deletedAt: null, status: "PAID", paidDate: { gte: monthStart, lte: monthEnd } },
      _sum: { paidAmount: true },
    }),
    db.payment.aggregate({
      where: { deletedAt: null, status: "PAID", paidDate: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { paidAmount: true },
    }),
    db.expense.aggregate({
      where: { deletedAt: null, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { deletedAt: null, date: { gte: lastMonthStart, lte: lastMonthEnd } },
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
      totalLeadsCount,
      monthlyLeadsCount,
      monthlyBookingsCount,
      upcomingJobsCount,
      siteVisitsToday,
      activeJobsCount,
      todaysJobsCount,
      tomorrowsJobsCount,
      pendingFollowUpsCount,
      pendingPaymentsCount: pendingPaymentsAgg._count,
      pendingPaymentsTotal,
      pendingAdvanceCount: pendingAdvanceAgg._count,
      pendingAdvanceTotal: pendingAdvanceAgg._sum.amount ?? 0,
      revenueToday: collectionsTodayAgg._sum.paidAmount ?? 0,
      collectionsTodayCount: collectionsTodayAgg._count,
      monthlyRevenue,
      netProfit,
      staffAvailableCount,
      staffOnJobCount,
      vehiclesActiveCount,
      upcomingAmcCount,
      reviewsPendingCount: Math.max(completed30Count - reviews30Count, 0),
      revenueTrend,
      profitTrend,
    },
    recentLeads,
    todaysJobs,
    overduePayments,
    followUpsToday,
    followUpsTomorrow,
    followUpsOverdue,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
