// Staff App / Staff Portal data layer.
//
// SECURITY MODEL — every function here takes a staffId that the caller got
// from getMyStaff(session), never from the URL or the client. Nothing in
// this module ever returns company sales, profit, purchases, expenses, job
// value / customer pricing, customer mobile numbers, or any other staff
// member's pay, attendance or contact details. Teammates are names only.
//
// PERFORMANCE — month/day/year views are a fixed handful of indexed range
// queries per request (staffId + date), no N+1 loops, no polling.

import { db } from "@/lib/db";
import { packageSummary, parsePackage } from "@/lib/package-calc";
import { staffBalanceToCollect } from "@/lib/payment-status";
import type { SessionPayload } from "@/lib/session";
import { computeEarned, type AttendanceCode } from "@/server/attendance";

export type MyStaff = {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  mobile: string;
  photoUrl: string | null;
  joinedOn: Date;
  salaryType: string;
  dailyWage: number | null;
  monthlySalary: number | null;
};

const MY_STAFF_SELECT = {
  id: true,
  name: true,
  employeeCode: true,
  designation: true,
  mobile: true,
  photoUrl: true,
  joinDate: true,
  joiningDate: true,
  salaryType: true,
  dailyWage: true,
  monthlySalary: true,
} as const;

/**
 * The signed-in user's own Staff record. Primary link is Staff.userId. For a
 * STAFF login created before the Staff App existed, links once by mobile —
 * only when exactly one active, still-unlinked staff record has that number.
 */
export async function getMyStaff(session: SessionPayload): Promise<MyStaff | null> {
  let staff = await db.staff.findFirst({ where: { userId: session.sub, deletedAt: null }, select: MY_STAFF_SELECT });
  if (!staff && session.role === "STAFF") {
    const user = await db.user.findUnique({ where: { id: session.sub }, select: { phone: true } });
    const digits = (user?.phone ?? "").replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      const matches = await db.staff.findMany({
        where: { mobile: { contains: digits }, userId: null, deletedAt: null, isActive: true },
        select: { id: true },
        take: 2,
      });
      if (matches.length === 1) {
        await db.staff.update({ where: { id: matches[0].id }, data: { userId: session.sub } });
        staff = await db.staff.findUnique({ where: { id: matches[0].id }, select: MY_STAFF_SELECT });
      }
    }
  }
  if (!staff) return null;
  const { joinDate, joiningDate, ...rest } = staff;
  return { ...rest, joinedOn: joiningDate ?? joinDate };
}

/** Owner preview only — callers must already have verified an ADMIN session (see staff-portal-session.ts). */
export async function getStaffForPreview(staffId: string): Promise<(MyStaff & { userId: string | null }) | null> {
  const staff = await db.staff.findFirst({ where: { id: staffId, deletedAt: null }, select: { ...MY_STAFF_SELECT, userId: true } });
  if (!staff) return null;
  const { joinDate, joiningDate, ...rest } = staff;
  return { ...rest, joinedOn: joiningDate ?? joinDate };
}

// ── date helpers (local-midnight convention, server TZ = Asia/Kolkata) ──

export function parseIsoDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? null : d;
}

export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── team (historical-safe) ──

export type TeamMember = { staffId: string; name: string; isLead: boolean; isMe: boolean };

type JobForTeam = {
  teamSnapshot: string | null;
  assignments: { staffId: string; isLead: boolean; staff: { name: string } }[];
};

/** The job's team exactly as recorded: frozen snapshot if the job completed, else the live crew. */
export function teamOf(job: JobForTeam, myStaffId: string): TeamMember[] {
  if (job.teamSnapshot) {
    try {
      const snap = JSON.parse(job.teamSnapshot) as { staffId: string; name: string; isLead?: boolean }[];
      return snap.map((m) => ({ staffId: m.staffId, name: m.name, isLead: Boolean(m.isLead), isMe: m.staffId === myStaffId }));
    } catch {
      // fall through to live crew
    }
  }
  return job.assignments.map((a) => ({ staffId: a.staffId, name: a.staff.name, isLead: a.isLead, isMe: a.staffId === myStaffId }));
}

/** Jobs a staff member worked or is booked on: assigned crew OR supervisor. */
function myJobsWhere(staffId: string, from: Date, to: Date) {
  // Owner rule 2026-10-05: Staff never see FUTURE assignments (no planning
  // leave around them) — today and past only, whatever range is asked for.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const until = to > endOfToday ? endOfToday : to;
  return {
    deletedAt: null,
    status: { not: "CANCELLED" as const },
    scheduledDate: { gte: from, lt: until },
    OR: [{ assignments: { some: { staffId } } }, { supervisorId: staffId }],
  };
}

const JOB_STAFF_SELECT = {
  id: true,
  jobNumber: true,
  service: true,
  serviceVariant: true,
  packageName: true,
  scheduledDate: true,
  scheduledTime: true,
  status: true,
  area: true,
  teamNumber: true,
  teamSnapshot: true,
  supervisor: { select: { name: true } },
  assignments: { select: { staffId: true, isLead: true, staff: { select: { name: true } } } },
} as const;

// ── Home ──

export async function getPortalHome(staff: MyStaff, userId: string | null = null) {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 8);

  const [attendance, jobs, announcements] = await Promise.all([
    // Range, not exact match: older rows were stored at UTC midnight, newer at IST midnight.
    db.attendance.findFirst({
      where: { staffId: staff.id, date: { gte: today, lt: tomorrow } },
      select: { status: true, checkInTime: true, checkOutTime: true },
    }),
    db.job.findMany({
      where: myJobsWhere(staff.id, today, weekAhead),
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      take: 10,
      // Address + map are shown only for today's/upcoming work — needed to reach the site.
      select: { ...JOB_STAFF_SELECT, address: true, mapLink: true, customerName: true },
    }),
    getActiveAnnouncements(3, { staffId: staff.id, userId }),
  ]);

  const todays = jobs.filter((j) => j.scheduledDate < tomorrow);
  const upcoming = jobs.filter((j) => j.scheduledDate >= tomorrow);
  const shape = (j: (typeof jobs)[number]) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    service: j.service,
    serviceVariant: j.serviceVariant,
    packageName: j.packageName,
    scheduledDate: j.scheduledDate,
    scheduledTime: j.scheduledTime,
    status: j.status,
    area: j.area,
    address: j.address,
    mapLink: j.mapLink,
    customerName: j.customerName,
    teamNumber: j.teamNumber,
    supervisorName: j.supervisor?.name ?? null,
    team: teamOf(j, staff.id),
  });

  return {
    attendance,
    todaysJobs: todays.map(shape),
    upcomingJobs: upcoming.map(shape),
    announcements,
  };
}

/**
 * Office announcements this staff member is a recipient of (ALL, or their id
 * in the resolved recipient list), with read / unread for their login.
 * Job assignments are NEVER announcements — they are job notifications.
 */
export async function getActiveAnnouncements(limit: number, viewer: { staffId: string; userId: string | null }) {
  const now = new Date();
  const rows = await db.announcement.findMany({
    where: { isActive: true, publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ important: "desc" }, { publishedAt: "desc" }],
    take: 200,
    select: { id: true, title: true, body: true, important: true, publishedAt: true, createdByName: true, audience: true, staffIds: true },
  });
  const mine = rows
    .filter((a) => {
      if (a.audience === "ALL" || !a.audience) return true;
      try {
        return (JSON.parse(a.staffIds ?? "[]") as string[]).includes(viewer.staffId);
      } catch {
        return false;
      }
    })
    .slice(0, limit);
  const reads = viewer.userId
    ? await db.announcementRead.findMany({ where: { userId: viewer.userId, announcementId: { in: mine.map((a) => a.id) } }, select: { announcementId: true } })
    : [];
  const readSet = new Set(reads.map((r) => r.announcementId));
  return mine.map(({ staffIds: _s, ...a }) => ({ ...a, read: readSet.has(a.id) }));
}

// ── Calendar ──

export type CalendarDay = {
  iso: string;
  day: number;
  weekday: number;
  isToday: boolean;
  isFuture: boolean;
  status: AttendanceCode | null;
  jobCount: number;
  hasAdvance: boolean;
  hasFine: boolean;
  hasReward: boolean;
};

async function rangeData(staffId: string, from: Date, to: Date) {
  const [nativeAttendance, imported, jobs, advances, fines, rewards] = await Promise.all([
    db.attendance.findMany({ where: { staffId, date: { gte: from, lt: to } }, select: { date: true, status: true, wageForDay: true } }),
    // Khata Book work days (imported history) show as Present on the calendar where no app attendance exists.
    db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null, kind: "EARNING", date: { gte: from, lt: to } }, select: { date: true } }),
    db.job.findMany({ where: myJobsWhere(staffId, from, to), select: { scheduledDate: true } }),
    db.advance.findMany({ where: { staffId, givenAt: { gte: from, lt: to } }, select: { givenAt: true, amount: true } }),
    db.fineRecord.findMany({ where: { staffId, date: { gte: from, lt: to } }, select: { date: true, amount: true } }),
    db.rewardRecord.findMany({ where: { staffId, date: { gte: from, lt: to } }, select: { date: true, amount: true } }),
  ]);
  const seen = new Set(nativeAttendance.map((a) => a.date.toDateString()));
  const attendance = [...nativeAttendance];
  for (const i of imported) {
    const k = i.date.toDateString();
    if (!seen.has(k)) {
      seen.add(k);
      attendance.push({ date: i.date, status: "PRESENT" as AttendanceCode, wageForDay: null });
    }
  }
  return { attendance, jobs, advances, fines, rewards };
}

export async function getMyMonth(staffId: string, year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  const { attendance, jobs, advances, fines, rewards } = await rangeData(staffId, from, to);

  const statusByDay = new Map(attendance.map((a) => [new Date(a.date).getDate(), a.status as AttendanceCode]));
  const countBy = (dates: Date[]) => {
    const m = new Map<number, number>();
    for (const d of dates) m.set(new Date(d).getDate(), (m.get(new Date(d).getDate()) ?? 0) + 1);
    return m;
  };
  const jobsBy = countBy(jobs.map((j) => j.scheduledDate));
  const advBy = countBy(advances.map((a) => a.givenAt));
  const fineBy = countBy(fines.map((f) => f.date));
  const rewardBy = countBy(rewards.map((r) => r.date));

  const today = startOfToday();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    const n = i + 1;
    return {
      iso: toIsoDay(date),
      day: n,
      weekday: date.getDay(),
      isToday: date.getTime() === today.getTime(),
      isFuture: date > today,
      status: statusByDay.get(n) ?? null,
      jobCount: jobsBy.get(n) ?? 0,
      hasAdvance: advBy.has(n),
      hasFine: fineBy.has(n),
      hasReward: rewardBy.has(n),
    };
  });

  const count = (s: AttendanceCode) => attendance.filter((a) => a.status === s).length;
  return {
    days,
    totals: {
      present: count("PRESENT"),
      halfDay: count("HALF_DAY"),
      absent: count("ABSENT"),
      leave: count("LEAVE"),
      weeklyOff: count("WEEKLY_OFF"),
      jobs: jobs.length,
      upcomingJobs: jobs.filter((j) => j.scheduledDate >= today).length,
    },
  };
}

/** Year view: per-day status code for 12 mini-months + per-month counts. */
export async function getMyYear(staffId: string, year: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const { attendance, jobs } = await rangeData(staffId, from, to);
  const statusByIso = new Map(attendance.map((a) => [toIsoDay(new Date(a.date)), a.status as AttendanceCode]));
  const jobIsos = new Set(jobs.map((j) => toIsoDay(new Date(j.scheduledDate))));
  const today = startOfToday();

  const months = Array.from({ length: 12 }, (_, m) => {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const firstWeekday = new Date(year, m, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, m, i + 1);
      const iso = toIsoDay(date);
      return { iso, day: i + 1, status: statusByIso.get(iso) ?? null, hasJob: jobIsos.has(iso), isFuture: date > today };
    });
    const c = (s: AttendanceCode) => days.filter((d) => d.status === s).length;
    return {
      month: m + 1,
      firstWeekday,
      days,
      present: c("PRESENT"),
      halfDay: c("HALF_DAY"),
      absent: c("ABSENT"),
      leave: c("LEAVE"),
      weeklyOff: c("WEEKLY_OFF"),
      jobs: days.filter((d) => d.hasJob).length,
    };
  });
  return { months };
}

// ── Day detail ──

export async function getMyDay(staffId: string, day: Date) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const [attendance, jobs, advances, fines, rewards, payments] = await Promise.all([
    db.attendance.findFirst({
      where: { staffId, date: { gte: from, lt: to } },
      select: { status: true, checkInTime: true, checkOutTime: true, wageForDay: true, notes: true },
    }),
    db.job.findMany({
      where: myJobsWhere(staffId, from, to),
      orderBy: { scheduledTime: "asc" },
      // Scope, site and collection details for the crew. Owner rule
      // 2026-10-10: only the balance to collect leaves this module — never
      // the job amount, paid amount, customerMobile, profit or staff cost.
      select: {
        ...JOB_STAFF_SELECT,
        address: true,
        mapLink: true,
        customerName: true,
        comboServices: true,
        jobValue: true,
        priceType: true,
        festivalName: true,
        scopeOfWork: true,
        payments: { where: { deletedAt: null }, select: { paidAmount: true } },
      },
    }),
    db.advance.findMany({ where: { staffId, givenAt: { gte: from, lt: to } }, orderBy: { givenAt: "asc" }, select: { id: true, amount: true, reason: true, givenAt: true } }),
    db.fineRecord.findMany({ where: { staffId, date: { gte: from, lt: to } }, orderBy: { date: "asc" }, select: { id: true, type: true, amount: true, notes: true, date: true } }),
    db.rewardRecord.findMany({
      where: { staffId, date: { gte: from, lt: to } },
      orderBy: { date: "asc" },
      select: { id: true, type: true, amount: true, notes: true, date: true },
    }),
    salaryPaidWhere(staffId, from, to, "asc"),
  ]);

  // Job numbers for fines/rewards that point at a job (team incentive etc.).
  const reviews = jobs.length
    ? await db.review.findMany({ where: { jobId: { in: jobs.map((j) => j.id) } }, select: { jobId: true, rating: true, comment: true } })
    : [];
  const incentives = jobs.length
    ? await db.teamIncentive.findMany({ where: { jobId: { in: jobs.map((j) => j.id) } }, select: { id: true, jobId: true, amount: true } })
    : [];

  return {
    attendance,
    jobs: jobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      service: j.service,
      serviceVariant: j.serviceVariant,
      packageName: j.packageName,
      scheduledTime: j.scheduledTime,
      status: j.status,
      area: j.area,
      address: j.address,
      mapLink: j.mapLink,
      customerName: j.customerName,
      comboServices: parseList(j.comboServices),
      priceType: j.priceType,
      festivalName: j.festivalName,
      scopeOfWork: j.scopeOfWork,
      collect: staffBalanceToCollect(j.jobValue, j.payments),
      teamNumber: j.teamNumber,
      supervisorName: j.supervisor?.name ?? null,
      team: teamOf(j, staffId),
      teamFrozen: Boolean(j.teamSnapshot),
      feedback: reviews.filter((r) => r.jobId === j.id).map((r) => ({ rating: r.rating, comment: r.comment })),
      // Team total for the whole team — not this staff member's pay.
      teamIncentive: incentives.find((t) => t.jobId === j.id) ?? null,
    })),
    advances,
    fines,
    rewards,
    payments,
  };
}

// ── Records (monthly / yearly) ──

export type MonthSummary = {
  month: number;
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  weeklyOff: number;
  payableDays: number;
  earned: number;
  rewards: number;
  advances: number;
  fines: number;
  netPayable: number;
};

/** Twelve monthly payroll summaries in 5 queries — same rule as getStaffLedger (computeEarned). */
export async function getMyYearSummary(staff: MyStaff, year: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const [{ attendance, advances, fines, rewards }, paidAgg] = await Promise.all([
    rangeData(staff.id, from, to),
    db.expense.aggregate({ where: salaryPaidFilter(staff.id, from, to), _sum: { amount: true } }),
  ]);
  const inMonth = <T,>(rows: T[], get: (r: T) => Date, m: number) => rows.filter((r) => new Date(get(r)).getMonth() === m);
  const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);

  const months: MonthSummary[] = Array.from({ length: 12 }, (_, m) => {
    const att = inMonth(attendance, (a) => a.date, m);
    const { payableDays, earned } = computeEarned(staff, att);
    const rewardsT = sum(inMonth(rewards, (r) => r.date, m));
    const advT = sum(inMonth(advances, (a) => a.givenAt, m));
    const fineT = sum(inMonth(fines, (f) => f.date, m));
    const netPayable = earned + rewardsT - advT - fineT;
    const c = (s: string) => att.filter((a) => a.status === s).length;
    return {
      month: m + 1,
      present: c("PRESENT"),
      halfDay: c("HALF_DAY"),
      absent: c("ABSENT"),
      leave: c("LEAVE"),
      weeklyOff: c("WEEKLY_OFF"),
      payableDays,
      earned: round2(earned),
      rewards: round2(rewardsT),
      advances: round2(advT),
      fines: round2(fineT),
      netPayable: round2(netPayable),
    };
  });

  const total = months.reduce(
    (t, m) => {
      for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += m[k];
      return t;
    },
    { present: 0, halfDay: 0, absent: 0, leave: 0, weeklyOff: 0, payableDays: 0, earned: 0, rewards: 0, advances: 0, fines: 0, netPayable: 0 },
  );
  // Salary paid comes from the office's Expense entries (category SALARY,
  // linked to this staff member) — the CRM's single record of payouts.
  const paid = round2(paidAgg._sum.amount ?? 0);
  return { months, total: { ...total, paid, balance: round2(total.netPayable - paid) } };
}

/** Salary payouts = Expense rows in category SALARY linked to the staff member (no separate payroll ledger). */
function salaryPaidFilter(staffId: string, from: Date, to: Date) {
  return { staffId, category: "SALARY" as const, deletedAt: null, isDemo: false, date: { gte: from, lt: to } };
}

function salaryPaidWhere(staffId: string, from: Date, to: Date, order: "asc" | "desc") {
  return db.expense.findMany({
    where: salaryPaidFilter(staffId, from, to),
    orderBy: { date: order },
    select: { id: true, amount: true, date: true, description: true },
  });
}

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getMyLedgerLists(staffId: string, year: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const [attendance, advances, fines, rewards, payments, advanceLifetime] = await Promise.all([
    db.attendance.findMany({ where: { staffId, date: { gte: from, lt: to } }, orderBy: { date: "desc" }, select: { id: true, date: true, status: true, checkInTime: true, checkOutTime: true } }),
    db.advance.findMany({ where: { staffId, givenAt: { gte: from, lt: to } }, orderBy: { givenAt: "desc" }, select: { id: true, amount: true, reason: true, givenAt: true } }),
    db.fineRecord.findMany({ where: { staffId, date: { gte: from, lt: to } }, orderBy: { date: "desc" }, select: { id: true, type: true, amount: true, notes: true, date: true } }),
    db.rewardRecord.findMany({ where: { staffId, date: { gte: from, lt: to } }, orderBy: { date: "desc" }, select: { id: true, type: true, amount: true, notes: true, date: true } }),
    salaryPaidWhere(staffId, from, to, "desc"),
    db.advance.aggregate({ where: { staffId }, _sum: { amount: true } }),
  ]);
  // Team incentives this staff member's team received (team totals, not individual pay).
  const teamIncentives = await db.teamIncentive.findMany({
    where: { date: { gte: from, lt: to }, teamSnapshot: { contains: `"staffId":"${staffId}"` } },
    orderBy: { date: "desc" },
    select: { id: true, jobId: true, amount: true, date: true, teamSnapshot: true },
  });
  const tiJobs = teamIncentives.length
    ? await db.job.findMany({ where: { id: { in: teamIncentives.map((t) => t.jobId) } }, select: { id: true, jobNumber: true } })
    : [];
  return {
    attendance,
    advances,
    fines,
    rewards,
    payments,
    advanceLifetime: advanceLifetime._sum.amount ?? 0,
    teamIncentives: teamIncentives.map((t) => ({
      id: t.id,
      amount: t.amount,
      date: t.date,
      jobNumber: tiJobs.find((j) => j.id === t.jobId)?.jobNumber ?? "",
      teamSize: (JSON.parse(t.teamSnapshot) as unknown[]).length,
    })),
  };
}

/** Job/site history for the year, newest first (area + service only — no customer contact or price). */
export async function getMyJobHistory(staffId: string, year: number) {
  const jobs = await db.job.findMany({
    where: myJobsWhere(staffId, new Date(year, 0, 1), new Date(year + 1, 0, 1)),
    orderBy: { scheduledDate: "desc" },
    take: 400,
    select: JOB_STAFF_SELECT,
  });
  return jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    service: j.service,
    scheduledDate: j.scheduledDate,
    scheduledTime: j.scheduledTime,
    status: j.status,
    area: j.area,
    teamNumber: j.teamNumber,
    team: teamOf(j, staffId),
  }));
}

/** Who I worked with this year and how often (derived from job teams — no extra data stored). */
export function teamHistoryFrom(jobs: Awaited<ReturnType<typeof getMyJobHistory>>) {
  const byMate = new Map<string, { name: string; jobs: number; last: Date }>();
  for (const j of jobs) {
    for (const m of j.team) {
      if (m.isMe) continue;
      const cur = byMate.get(m.staffId);
      if (cur) {
        cur.jobs += 1;
        if (j.scheduledDate > cur.last) cur.last = j.scheduledDate;
      } else {
        byMate.set(m.staffId, { name: m.name, jobs: 1, last: j.scheduledDate });
      }
    }
  }
  return [...byMate.values()].sort((a, b) => b.jobs - a.jobs);
}

export async function getMyNotifications(userId: string, limit = 40) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, kind: true, title: true, body: true, href: true, critical: true, readAt: true, createdAt: true },
  });
}

export async function countMyUnread(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

// ── Staff Job Details (/my/jobs/[id]) ──
// Own job only (crew or supervisor), today or past — never a future job.
// Never includes customer mobile, office notes, lead source or any CRM data.
export async function getMyJob(staffId: string, jobId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, ...myJobsWhere(staffId, new Date(2000, 0, 1), new Date(2100, 0, 1)) },
    select: {
      id: true,
      jobNumber: true,
      service: true,
      serviceVariant: true,
      packageName: true,
      scheduledDate: true,
      scheduledTime: true,
      status: true,
      area: true,
      address: true,
      pinCode: true,
      mapLink: true,
      customerName: true,
      comboServices: true,
      serviceItems: true,
      scopeOfWork: true,
      priceType: true,
      festivalName: true,
      jobValue: true,
      teamSnapshot: true,
      supervisor: { select: { name: true, employeeCode: true } },
      assignments: { select: { staffId: true, isLead: true, staff: { select: { name: true, employeeCode: true } } } },
      payments: { where: { deletedAt: null }, select: { paidAmount: true } },
    },
  });
  if (!job) return null;
  const frozen = job.teamSnapshot ? (JSON.parse(job.teamSnapshot) as { staffId: string; name: string; employeeCode?: string; isLead: boolean }[]) : null;
  const team = (frozen ?? job.assignments.map((a) => ({ staffId: a.staffId, name: a.staff.name, employeeCode: a.staff.employeeCode, isLead: a.isLead }))).map((m) => ({
    ...m,
    isMe: m.staffId === staffId,
  }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Raw money fields (and raw serviceItems, which carry prices) never leave this function.
  const { jobValue, payments, serviceItems, ...safe } = job;
  return {
    ...safe,
    comboServices: parseList(job.comboServices),
    // Package services: names + quantity only — never prices (staff see no internal pricing).
    packageServices: packageSummary(parsePackage(serviceItems)),
    team,
    collect: staffBalanceToCollect(jobValue, payments),
    isToday: job.scheduledDate >= today,
  };
}
