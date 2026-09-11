import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, addDays, subDays, format } from "date-fns";
import { SERVICE_LABELS } from "@/lib/constants";
import { getBusinessTarget } from "@/server/actions/business-target";
import { getRevenueDashboard } from "@/server/revenue";

const SERVICE_ORDER = [
  "HOME_DEEP_CLEANING",
  "COMMERCIAL_CLEANING",
  "HOUSEKEEPING",
  "PEST_CONTROL",
  "INTERIOR_PAINTING",
] as const;

async function dayBreakdown(dayStart: Date, dayEnd: Date) {
  const [byService, followUps, siteVisits, collection] = await Promise.all([
    db.job.groupBy({
      by: ["service"],
      where: { deletedAt: null, scheduledDate: { gte: dayStart, lte: dayEnd } },
      _count: true,
    }),
    db.followUp.count({
      where: { isDone: false, dueDate: { gte: dayStart, lte: dayEnd }, lead: { deletedAt: null } },
    }),
    db.lead.count({
      where: { deletedAt: null, stage: "SITE_VISIT", followUpDate: { gte: dayStart, lte: dayEnd } },
    }),
    db.payment.aggregate({
      where: { deletedAt: null, paidDate: { gte: dayStart, lte: dayEnd } },
      _sum: { paidAmount: true },
      _count: true,
    }),
  ]);

  const byServiceMap = new Map(byService.map((r) => [r.service, r._count]));
  const categories = SERVICE_ORDER.map((s) => ({
    service: s,
    label: SERVICE_LABELS[s] ?? s,
    count: byServiceMap.get(s) ?? 0,
  }));
  const totalJobs = categories.reduce((sum, c) => sum + c.count, 0);

  return {
    totalJobs,
    categories,
    followUps,
    siteVisits,
    collectionCount: collection._count,
    collectionAmount: collection._sum.paidAmount ?? 0,
  };
}

// Owner Alert Center — only real, verifiable signals. Never fabricated.
// Judgment calls (documented for whoever tunes these later):
//  - "stale lead" = an open-pipeline lead (not yet CONFIRMED/JOB_SCHEDULED/
//    CANCELLED/COMPLETED) whose updatedAt is more than 5 days old.
//  - "unassigned job today" = a job scheduled today, not CANCELLED/COMPLETED,
//    with no supervisor AND no crew assignments.
export async function getOwnerAlerts() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const staleThreshold = subDays(now, 5);

  const [overduePayments, staleLeads, unassignedJobsToday] = await Promise.all([
    db.payment.findMany({
      where: { deletedAt: null, status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: { id: true, clientName: true, amount: true, paidAmount: true, dueDate: true, invoiceNumber: true },
    }),
    db.lead.findMany({
      where: {
        deletedAt: null,
        stage: { in: ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] },
        updatedAt: { lt: staleThreshold },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
      select: { id: true, name: true, stage: true, updatedAt: true, mobile: true },
    }),
    db.job.findMany({
      where: {
        deletedAt: null,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        supervisorId: null,
        assignments: { none: {} },
      },
      orderBy: { scheduledTime: "asc" },
      take: 8,
      select: { id: true, customerName: true, scheduledTime: true, jobNumber: true },
    }),
  ]);

  const overdue = overduePayments.map((p) => ({ ...p, outstanding: p.amount - p.paidAmount }));

  return {
    overduePayments: overdue,
    staleLeads,
    unassignedJobsToday,
    totalCount: overdue.length + staleLeads.length + unassignedJobsToday.length,
  };
}

// Smart Monthly Calendar — leads grouped by day (followUpDate, falling back to
// createdAt), with a "dominant" color per day: the color bucket with the most
// leads that day (ties broken green > blue > orange > red > white, i.e. the
// more "closed/positive" outcome wins the tie). COMPLETED is bucketed with
// CONFIRMED/JOB_SCHEDULED (green) — a judgment call, since the spec's mapping
// didn't name COMPLETED explicitly.
function bucketForStage(stage: string): "green" | "blue" | "orange" | "red" | "white" {
  if (stage === "CONFIRMED" || stage === "JOB_SCHEDULED" || stage === "COMPLETED") return "green";
  if (stage === "SITE_VISIT") return "blue";
  if (stage === "INTERESTED" || stage === "QUOTATION" || stage === "NEGOTIATION") return "orange";
  if (stage === "CANCELLED") return "red";
  return "white"; // NEW or anything unmapped
}

export type CalendarLead = { id: string; name: string; mobile: string; stage: string };

export async function getLeadMonthCalendar(year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const leads = await db.lead.findMany({
    where: {
      deletedAt: null,
      OR: [
        { followUpDate: { gte: monthStart, lte: monthEnd } },
        { followUpDate: null, createdAt: { gte: monthStart, lte: monthEnd } },
      ],
    },
    select: { id: true, name: true, mobile: true, stage: true, followUpDate: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const leadsByDay = new Map<string, CalendarLead[]>();
  for (const l of leads) {
    const d = l.followUpDate ?? l.createdAt;
    const iso = format(d, "yyyy-MM-dd");
    const arr = leadsByDay.get(iso) ?? [];
    arr.push({ id: l.id, name: l.name, mobile: l.mobile, stage: l.stage });
    leadsByDay.set(iso, arr);
  }

  const daysInMonth = monthEnd.getDate();
  const priority: ("green" | "blue" | "orange" | "red" | "white")[] = ["green", "blue", "orange", "red", "white"];
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateObj = new Date(year, month - 1, day);
    const iso = format(dateObj, "yyyy-MM-dd");
    const dayLeads = leadsByDay.get(iso) ?? [];
    const counts: Record<string, number> = {};
    for (const l of dayLeads) {
      const b = bucketForStage(l.stage);
      counts[b] = (counts[b] ?? 0) + 1;
    }
    let color: (typeof priority)[number] = "white";
    let max = 0;
    for (const p of priority) {
      const c = counts[p] ?? 0;
      if (c > max) {
        max = c;
        color = p;
      }
    }
    return { day, iso, weekday: dateObj.getDay(), count: dayLeads.length, color };
  });

  return {
    year,
    month,
    days,
    leadsByDay: Object.fromEntries(leadsByDay),
  };
}

// Business Target — weekly revenue breakdown (simple calendar-day buckets:
// days 1-7, 8-14, 15-21, 22-28, 29-end — not ISO weeks). A judgment call for
// simplicity; good enough for the "weekly breakdown" progress view.
async function getWeeklyRevenueBreakdown(year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const rows = await db.payment.findMany({
    where: { deletedAt: null, status: "PAID", paidDate: { gte: monthStart, lte: monthEnd } },
    select: { paidAmount: true, paidDate: true },
  });

  const weekCount = Math.ceil(monthEnd.getDate() / 7);
  const weeks = Array.from({ length: weekCount }, () => 0);
  for (const r of rows) {
    if (!r.paidDate) continue;
    const idx = Math.min(Math.floor((r.paidDate.getDate() - 1) / 7), weekCount - 1);
    weeks[idx] += r.paidAmount;
  }
  return weeks.map((amount, i) => ({ label: `Week ${i + 1}`, amount }));
}

export async function getOwnerCommandCenterHome() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    today,
    tomorrow,
    totalLeadsCount,
    target,
    revenue,
    staffList,
    vehicleList,
    alerts,
    calendar,
    weeklyRevenue,
  ] = await Promise.all([
    dayBreakdown(todayStart, todayEnd),
    dayBreakdown(tomorrowStart, tomorrowEnd),
    db.lead.count({ where: { deletedAt: null } }),
    getBusinessTarget(year, month),
    getRevenueDashboard(),
    db.staff.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, availability: true, designation: true },
    }),
    db.vehicle.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, plateNumber: true },
    }),
    getOwnerAlerts(),
    getLeadMonthCalendar(year, month),
    getWeeklyRevenueBreakdown(year, month),
  ]);

  const targetAmount = target?.targetAmount ?? null;
  const achieved = revenue.monthlyRevenue;
  const remaining = targetAmount != null ? Math.max(targetAmount - achieved, 0) : null;
  const progressPercent = targetAmount ? Math.round((achieved / targetAmount) * 100) : null;

  return {
    today,
    tomorrow,
    totalLeadsCount,
    businessTarget: {
      year,
      month,
      targetAmount,
      achieved,
      remaining,
      progressPercent,
      weekly: weeklyRevenue,
    },
    revenue,
    staffList,
    vehicleList,
    alerts,
    calendar,
  };
}

export type OwnerCommandCenterData = Awaited<ReturnType<typeof getOwnerCommandCenterHome>>;
