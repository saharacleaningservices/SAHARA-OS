import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";

export async function getAssistantOverview() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const weekAgoStart = startOfDay(subDays(now, 7));
  const weekAgoEnd = endOfDay(subDays(now, 1));
  const staleCutoff = subDays(now, 3);

  const [
    quotableLeads,
    duePayments,
    staffRaw,
    jobsNeedingCrewRaw,
    paidTodayAgg,
    paidYesterdayAgg,
    expensesTodayAgg,
    expensesYesterdayAgg,
    weekPaidAgg,
    weekExpensesAgg,
    jobsCompletedToday,
    leadsToday,
    dueFollowUps,
    staleLeadsRaw,
  ] = await Promise.all([
    db.lead.findMany({
      where: { stage: { in: ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, leadNumber: true, name: true, mobile: true, area: true, service: true, stage: true, quoteAmount: true },
    }),
    db.payment.findMany({
      where: { status: { not: "PAID" } },
      orderBy: { dueDate: "asc" },
      take: 15,
      select: { id: true, invoiceNumber: true, clientName: true, clientMobile: true, amount: true, paidAmount: true, dueDate: true, status: true },
    }),
    db.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        designation: true,
        availability: true,
        mobile: true,
        jobAssignments: { where: { job: { scheduledDate: { gte: todayStart } } }, select: { id: true } },
      },
    }),
    db.job.findMany({
      where: { status: "ASSIGNED", scheduledDate: { gte: todayStart } },
      include: { assignments: true },
      orderBy: { scheduledDate: "asc" },
      take: 30,
    }),
    db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: todayStart, lte: todayEnd } }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: yesterdayStart, lte: yesterdayEnd } }, _sum: { paidAmount: true } }),
    db.expense.aggregate({ where: { date: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: yesterdayStart, lte: yesterdayEnd } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: weekAgoStart, lte: weekAgoEnd } }, _sum: { paidAmount: true } }),
    db.expense.aggregate({ where: { date: { gte: weekAgoStart, lte: weekAgoEnd } }, _sum: { amount: true } }),
    db.job.count({ where: { completedAt: { gte: todayStart, lte: todayEnd } } }),
    db.lead.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    db.followUp.findMany({
      where: { isDone: false, dueDate: { lte: todayEnd } },
      include: { lead: { select: { id: true, name: true, mobile: true, area: true, service: true, stage: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    db.lead.findMany({
      where: { stage: { notIn: ["COMPLETED"] }, updatedAt: { lt: staleCutoff } },
      orderBy: { updatedAt: "asc" },
      take: 20,
      select: { id: true, name: true, mobile: true, area: true, service: true, stage: true, updatedAt: true },
    }),
  ]);

  const staffList = staffRaw.map((s) => ({
    id: s.id,
    name: s.name,
    designation: s.designation,
    availability: s.availability,
    mobile: s.mobile,
    upcomingJobs: s.jobAssignments.length,
  }));

  const jobsNeedingCrew = jobsNeedingCrewRaw
    .filter((j) => j.assignments.length < 2)
    .slice(0, 10)
    .map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customerName: j.customerName,
      service: j.service,
      area: j.area,
      scheduledDate: j.scheduledDate,
      scheduledTime: j.scheduledTime,
      crewCount: j.assignments.length,
    }));

  // Follow-ups already covered by an explicit FollowUp record shouldn't also
  // show up as a "stale" nudge for the same lead.
  const followedLeadIds = new Set(dueFollowUps.map((f) => f.lead.id));
  const staleLeads = staleLeadsRaw.filter((l) => !followedLeadIds.has(l.id)).slice(0, 15);

  const paidToday = paidTodayAgg._sum.paidAmount ?? 0;
  const paidYesterday = paidYesterdayAgg._sum.paidAmount ?? 0;
  const expensesToday = expensesTodayAgg._sum.amount ?? 0;
  const expensesYesterday = expensesYesterdayAgg._sum.amount ?? 0;
  const weekPaid = weekPaidAgg._sum.paidAmount ?? 0;
  const weekExpenses = weekExpensesAgg._sum.amount ?? 0;
  const avgDailyProfit7d = (weekPaid - weekExpenses) / 7;

  return {
    quotableLeads,
    duePayments,
    staffList,
    jobsNeedingCrew,
    dueFollowUps,
    staleLeads,
    profitInputs: {
      paidToday,
      paidYesterday,
      expensesToday,
      expensesYesterday,
      jobsCompletedToday,
      leadsToday,
      avgDailyProfit7d,
    },
  };
}

export type AssistantOverview = Awaited<ReturnType<typeof getAssistantOverview>>;
