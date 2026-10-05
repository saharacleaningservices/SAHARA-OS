import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";
import { getTodayAttendanceSummary } from "@/server/attendance";
import { supervisorLeadWhere, operationsLeadWhere } from "@/server/leads";
import { slotStartMinutes } from "@/lib/utils";

/**
 * `role` scopes the two "actionable booking visibility" lists — upcomingJobs
 * and recentLeads — to today + tomorrow for field-restricted roles. Originally
 * built 2026-09-21 for Francis while he held SUPERVISOR; Francis moved to
 * OPERATIONS on 2026-09-25 and the same restriction moves with him (he's the
 * sole OPERATIONS user — see isFieldRestricted below). Every other role
 * (ADMIN/ACCOUNTS/STAFF) is unaffected — omit `role` or pass a role that
 * isn't SUPERVISOR/OPERATIONS for the original unscoped (full week ahead)
 * behavior.
 */
export async function getDashboardData(role?: string, userId?: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekAheadEnd = endOfDay(addDays(now, 7));
  const isFieldRestricted = role === "SUPERVISOR" || role === "OPERATIONS";
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
    upcomingJobs,
    overduePayments,
    followUpsToday,
    followUpsTomorrow,
    followUpsOverdue,
    monthPayments,
    lastMonthPayments,
    monthExpenses,
    lastMonthExpenses,
    convertedLeadsCount,
    vehiclesInUseCount,
    recentReviews,
    attendanceSummary,
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
    db.lead.findMany({
      where: isFieldRestricted ? { deletedAt: null, ...(role === "OPERATIONS" && userId ? operationsLeadWhere(userId) : supervisorLeadWhere()) } : { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.job.findMany({
      where: { deletedAt: null, scheduledDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledTime: "asc" },
      include: { supervisor: true },
      take: 30,
    }),
    db.job.findMany({
      where: {
        deletedAt: null,
        status: { not: "COMPLETED" },
        scheduledDate: { gte: todayStart, lte: isFieldRestricted ? tomorrowEnd : weekAheadEnd },
      },
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      include: { supervisor: true },
      take: 10,
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
    // Overdue follow-ups are, by definition, historical (dueDate before
    // today) — exactly the "no unrestricted browsing of historical leads"
    // category Francis's policy forbids. Returns nothing for SUPERVISOR
    // rather than relying solely on the page hiding the card/list.
    isFieldRestricted
      ? Promise.resolve([])
      : db.followUp.findMany({
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
    // Conversion Rate — leads that reached CONFIRMED or later in the current
    // pipeline (Pending Job / Completed), all-time against totalLeadsCount.
    // All-time (not "this month") so a small monthly lead volume doesn't
    // make the percentage swing wildly day to day.
    db.lead.count({ where: { deletedAt: null, stage: { in: ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"] } } }),
    // Vehicle Status — active vehicles currently tied to a job in progress
    // today (Assigned/On the Way/Started). vehiclesActiveCount minus this is
    // "available".
    db.vehicle.count({
      where: {
        isActive: true,
        jobs: {
          some: {
            deletedAt: null,
            scheduledDate: { gte: todayStart, lte: todayEnd },
            status: { in: ["ASSIGNED", "ON_THE_WAY", "STARTED"] },
          },
        },
      },
    }),
    // Recent Reviews — real Review rows (customerMobile/rating/comment).
    // Nothing in the app writes to this table yet (no review-capture flow
    // wired up), so this list renders empty until that exists — no fake data.
    db.review.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    // Staff Attendance — today's Present/Absent/Half-day summary, reusing
    // the same aggregation the Attendance page and WhatsApp summary use.
    getTodayAttendanceSummary(),
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

  // Repeat customers = mobile numbers with more than one job.
  const jobMobiles = await db.job.groupBy({
    by: ["customerMobile"],
    where: { deletedAt: null },
    _count: true,
  });
  const repeatCustomerCount = jobMobiles.filter((r) => r._count > 1).length;
  const collectionRate =
    monthlyRevenue + pendingPaymentsTotal > 0
      ? Math.round((monthlyRevenue / (monthlyRevenue + pendingPaymentsTotal)) * 100)
      : 0;

  const conversionRate = totalLeadsCount > 0 ? Math.round((convertedLeadsCount / totalLeadsCount) * 100) : 0;

  // Recent contacts for the dashboard "Quick Call" tool. Not currently
  // rendered by the shared (non-owner) dashboard page, but scoped for
  // SUPERVISOR anyway (defense in depth) since it's cheap and this is
  // exactly the "historical lead/job data outside the permitted scope"
  // category his policy forbids.
  const [recentLeadContacts, recentJobContacts] = await Promise.all([
    db.lead.findMany({
      where: isFieldRestricted ? { deletedAt: null, ...(role === "OPERATIONS" && userId ? operationsLeadWhere(userId) : supervisorLeadWhere()) } : { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { name: true, mobile: true },
    }),
    db.job.findMany({
      where: isFieldRestricted
        ? { deletedAt: null, scheduledDate: { gte: todayStart, lte: tomorrowEnd } }
        : { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { customerName: true, customerMobile: true },
    }),
  ]);
  const seen = new Set<string>();
  const recentContacts: { name: string; mobile: string }[] = [];
  for (const c of [
    ...recentLeadContacts.map((l) => ({ name: l.name, mobile: l.mobile })),
    ...recentJobContacts.map((j) => ({ name: j.customerName, mobile: j.customerMobile })),
  ]) {
    if (!c.mobile || seen.has(c.mobile)) continue;
    seen.add(c.mobile);
    recentContacts.push(c);
    if (recentContacts.length >= 12) break;
  }

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
      collectionRate,
      repeatCustomerCount,
      netProfit,
      staffAvailableCount,
      staffOnJobCount,
      vehiclesActiveCount,
      upcomingAmcCount,
      reviewsPendingCount: Math.max(completed30Count - reviews30Count, 0),
      revenueTrend,
      profitTrend,
      convertedLeadsCount,
      conversionRate,
      vehiclesInUseCount,
      attendancePresent: attendanceSummary.present,
      attendanceAbsent: attendanceSummary.absent,
      attendanceHalfDay: attendanceSummary.halfDay,
      attendanceTotal: attendanceSummary.total,
    },
    recentLeads,
    recentContacts,
    recentReviews,
    // scheduledTime is a label ("8:00 – 11:00"), so order by real start time.
    todaysJobs: [...todaysJobs].sort((a, b) => slotStartMinutes(a.scheduledTime) - slotStartMinutes(b.scheduledTime)),
    upcomingJobs: [...upcomingJobs].sort(
      (a, b) => startOfDay(a.scheduledDate).getTime() - startOfDay(b.scheduledDate).getTime() || slotStartMinutes(a.scheduledTime) - slotStartMinutes(b.scheduledTime),
    ),
    overduePayments,
    followUpsToday,
    followUpsTomorrow,
    followUpsOverdue,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
