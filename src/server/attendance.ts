import { db } from "@/lib/db";
import { COMPANY } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { dailyAttendanceSummaryMessage } from "@/lib/whatsapp-templates";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// ─────────────────────────────────────────────────────────────────────────
// Monthly attendance calendar — Master Prompt v2.0 Phase 4
// ─────────────────────────────────────────────────────────────────────────

export type AttendanceCode = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "WEEKLY_OFF";

/** Short calendar code shown in the grid. */
export const ATTENDANCE_CODE_LABEL: Record<AttendanceCode, string> = {
  PRESENT: "P",
  ABSENT: "A",
  HALF_DAY: "H",
  LEAVE: "L",
  WEEKLY_OFF: "WO",
};

const WAGE_FACTOR: Record<AttendanceCode, number> = {
  PRESENT: 1,
  HALF_DAY: 0.5,
  ABSENT: 0,
  LEAVE: 0,
  WEEKLY_OFF: 0,
};

/** A staff member's effective per-day wage (daily wage, or 1/30 of monthly). */
export function dailyWageFor(staff: { salaryType: string; dailyWage: number | null; monthlySalary: number | null }): number {
  if (staff.salaryType === "DAILY") return staff.dailyWage ?? 0;
  return staff.monthlySalary ? staff.monthlySalary / 30 : 0;
}

export function wageForDayValue(
  staff: { salaryType: string; dailyWage: number | null; monthlySalary: number | null },
  status: AttendanceCode,
): number {
  return Math.round(dailyWageFor(staff) * WAGE_FACTOR[status] * 100) / 100;
}

/**
 * Normalize any day reference to local midnight, matching the app-wide
 * `todayRange()` convention. An ISO "YYYY-MM-DD" string is read as calendar
 * parts (never UTC-parsed) so the stored day is server-timezone-independent.
 */
function dayKey(input: string | Date): Date {
  if (typeof input === "string") {
    const [y, m, d] = input.slice(0, 10).split("-").map(Number);
    const x = new Date(y, (m ?? 1) - 1, d ?? 1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  const x = new Date(input);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function isMonthClosed(year: number, month: number): Promise<boolean> {
  const row = await db.monthClose.findUnique({ where: { year_month: { year, month } } });
  return Boolean(row && !row.reopenedAt);
}

export async function getMonthCloseState(year: number, month: number) {
  const row = await db.monthClose.findUnique({ where: { year_month: { year, month } } });
  return { closed: Boolean(row && !row.reopenedAt), row };
}

/**
 * The full month grid for one staff member: one entry per calendar day,
 * 1 → last day of month. `status` is null for un-marked days.
 */
export async function getMonthMatrix(staffId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const [staff, rows, closed] = await Promise.all([
    db.staff.findUnique({ where: { id: staffId } }),
    db.attendance.findMany({ where: { staffId, date: { gte: start, lt: end } } }),
    isMonthClosed(year, month),
  ]);

  const byDay = new Map<number, (typeof rows)[number]>();
  for (const r of rows) byDay.set(new Date(r.date).getDate(), r);

  const today = dayKey(new Date());
  const mm = String(month).padStart(2, "0");
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(year, month - 1, dayNum);
    const rec = byDay.get(dayNum);
    return {
      day: dayNum,
      iso: `${year}-${mm}-${String(dayNum).padStart(2, "0")}`,
      weekday: date.getDay(), // 0 = Sun
      isFuture: date > today,
      status: (rec?.status ?? null) as AttendanceCode | null,
      checkInTime: rec?.checkInTime ?? null,
      checkOutTime: rec?.checkOutTime ?? null,
    };
  });

  const count = (s: AttendanceCode) => days.filter((d) => d.status === s).length;
  const totals = {
    present: count("PRESENT"),
    half: count("HALF_DAY"),
    absent: count("ABSENT"),
    leave: count("LEAVE"),
    weeklyOff: count("WEEKLY_OFF"),
    marked: days.filter((d) => d.status).length,
    payableDays: count("PRESENT") + count("HALF_DAY") * 0.5,
  };

  return { staff, year, month, days, totals, closed };
}

/** Upsert one day's attendance, write the audit row, recompute the day wage. */
export async function setAttendanceForDate(input: {
  staffId: string;
  date: string | Date;
  status: AttendanceCode;
  actorName: string;
}) {
  const date = dayKey(input.date);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (await isMonthClosed(year, month)) {
    return { error: `${year}-${String(month).padStart(2, "0")} is closed. Ask the Super Admin to reopen it.` as string };
  }

  const staff = await db.staff.findUnique({ where: { id: input.staffId } });
  if (!staff) return { error: "Staff not found" };

  const existing = await db.attendance.findUnique({
    where: { staffId_date: { staffId: input.staffId, date } },
  });
  const wageForDay = wageForDayValue(staff, input.status);

  if (existing) {
    if (existing.status === input.status) return { success: true as const, unchanged: true as const };
    await db.attendance.update({
      where: { id: existing.id },
      data: { status: input.status, wageForDay, updatedByName: input.actorName, updatedAt: new Date() },
    });
  } else {
    await db.attendance.create({
      data: {
        staffId: input.staffId,
        date,
        status: input.status,
        wageForDay,
        method: "MANUAL",
        markedByName: input.actorName,
      },
    });
  }

  await db.attendanceAudit.create({
    data: {
      staffId: input.staffId,
      staffName: staff.name,
      date,
      oldStatus: existing?.status ?? null,
      newStatus: input.status,
      editedByName: input.actorName,
    },
  });

  return { success: true as const, staff };
}

/** Set the same status across an inclusive date range (skips closed months). */
export async function bulkSetAttendance(input: {
  staffId: string;
  from: string;
  to: string;
  status: AttendanceCode;
  actorName: string;
}) {
  const from = dayKey(input.from);
  const to = dayKey(input.to);
  if (to < from) return { error: "End date is before start date" };
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (spanDays > 62) return { error: "Range too large (max 62 days)" };

  let applied = 0;
  let skipped = 0;
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const res = await setAttendanceForDate({ staffId: input.staffId, date: d, status: input.status, actorName: input.actorName });
    if ("error" in res) skipped++;
    else applied++;
  }
  return { success: true as const, applied, skipped };
}

/** Office check-in for today (marks PRESENT + start time). */
export async function officeCheckIn(staffId: string, actorName: string) {
  const { start } = todayRange();
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return { error: "Staff not found" };
  const existing = await db.attendance.findUnique({ where: { staffId_date: { staffId, date: start } } });
  if (existing?.checkInTime) return { success: true as const, alreadyIn: true as const };

  if (existing) {
    await db.attendance.update({
      where: { id: existing.id },
      data: { checkInTime: new Date(), status: "PRESENT", wageForDay: wageForDayValue(staff, "PRESENT"), updatedByName: actorName, updatedAt: new Date() },
    });
  } else {
    await db.attendance.create({
      data: { staffId, date: start, status: "PRESENT", checkInTime: new Date(), wageForDay: wageForDayValue(staff, "PRESENT"), method: "MANUAL", markedByName: actorName },
    });
  }
  await db.attendanceAudit.create({
    data: { staffId, staffName: staff.name, date: start, oldStatus: existing?.status ?? null, newStatus: "PRESENT", editedByName: `${actorName} (check-in)` },
  });
  return { success: true as const, staff };
}

/** Office check-out for today (records end time + working hours). */
export async function officeCheckOut(staffId: string, actorName: string) {
  const { start } = todayRange();
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return { error: "Staff not found" };
  const existing = await db.attendance.findUnique({ where: { staffId_date: { staffId, date: start } } });
  if (!existing) return { error: "No check-in recorded today" };
  await db.attendance.update({
    where: { id: existing.id },
    data: { checkOutTime: new Date(), updatedByName: actorName, updatedAt: new Date() },
  });
  return { success: true as const, staff };
}

export async function closeMonth(year: number, month: number, actorName: string) {
  const existing = await db.monthClose.findUnique({ where: { year_month: { year, month } } });
  if (existing && !existing.reopenedAt) return { error: "Month already closed" };
  if (existing) {
    await db.monthClose.update({
      where: { id: existing.id },
      data: { closedByName: actorName, closedAt: new Date(), reopenedByName: null, reopenedAt: null },
    });
  } else {
    await db.monthClose.create({ data: { year, month, closedByName: actorName } });
  }
  return { success: true as const };
}

export async function reopenMonth(year: number, month: number, actorName: string) {
  const existing = await db.monthClose.findUnique({ where: { year_month: { year, month } } });
  if (!existing || existing.reopenedAt) return { error: "Month is not closed" };
  await db.monthClose.update({
    where: { id: existing.id },
    data: { reopenedByName: actorName, reopenedAt: new Date() },
  });
  return { success: true as const };
}

export async function listAttendanceAudit(limit = 200) {
  return db.attendanceAudit.findMany({ orderBy: { editedAt: "desc" }, take: limit });
}

export async function getTodayAttendance(staffId: string) {
  const { start, end } = todayRange();
  return db.attendance.findFirst({ where: { staffId, date: { gte: start, lt: end } } });
}

export async function checkIn(staffId: string, gpsLat?: number | null, gpsLng?: number | null) {
  const { start } = todayRange();
  const existing = await getTodayAttendance(staffId);
  if (existing?.checkInTime) return existing;

  const data = {
    checkInTime: new Date(),
    status: "PRESENT" as const,
    gpsLat: gpsLat ?? null,
    gpsLng: gpsLng ?? null,
    method: gpsLat != null && gpsLng != null ? "GPS" : "MANUAL",
  };

  if (existing) {
    return db.attendance.update({ where: { id: existing.id }, data });
  }
  return db.attendance.create({ data: { staffId, date: start, ...data } });
}

export async function checkOut(staffId: string) {
  const existing = await getTodayAttendance(staffId);
  if (!existing) return null;
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  const wageForDay = staff?.salaryType === "DAILY" ? staff?.dailyWage ?? null : null;
  return db.attendance.update({
    where: { id: existing.id },
    data: { checkOutTime: new Date(), wageForDay },
  });
}

export async function listAttendanceForMonth(staffId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return db.attendance.findMany({ where: { staffId, date: { gte: start, lt: end } }, orderBy: { date: "asc" } });
}

export async function listTodayAttendanceAll() {
  const { start, end } = todayRange();
  return db.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: { staff: { select: { id: true, name: true, employeeCode: true, designation: true } } },
    orderBy: { checkInTime: "asc" },
  });
}

/** Present + absent + half-day counts for every active staff member today (absent = no row at all). */
export async function getTodayAttendanceSummary() {
  const staff = await db.staff.findMany({ where: { isActive: true, deletedAt: null } });
  const records = await listTodayAttendanceAll();
  const byStaff = new Map(records.map((r) => [r.staffId, r]));

  let present = 0;
  let absent = 0;
  let halfDay = 0;
  for (const s of staff) {
    const rec = byStaff.get(s.id);
    if (!rec) {
      absent += 1;
    } else if (rec.status === "HALF_DAY") {
      halfDay += 1;
    } else if (rec.status === "ABSENT" || rec.status === "LEAVE") {
      absent += 1;
    } else {
      present += 1;
    }
  }
  return { present, absent, halfDay, total: staff.length };
}

/** Staff payroll ledger for one calendar month: earned wage, advances, fines, rewards, net balance. */
export async function getStaffLedger(staffId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [staff, attendance, advances, fines, rewards] = await Promise.all([
    db.staff.findUnique({ where: { id: staffId } }),
    listAttendanceForMonth(staffId, year, month),
    db.advance.findMany({ where: { staffId, givenAt: { gte: start, lt: end } }, orderBy: { givenAt: "desc" } }),
    db.fineRecord.findMany({ where: { staffId, date: { gte: start, lt: end } }, orderBy: { date: "desc" } }),
    db.rewardRecord.findMany({ where: { staffId, date: { gte: start, lt: end } }, orderBy: { date: "desc" } }),
  ]);

  const fullDays = attendance.filter((a) => a.status === "PRESENT").length;
  const halfDays = attendance.filter((a) => a.status === "HALF_DAY").length;
  const payableDays = fullDays + halfDays * 0.5;
  const presentDays = fullDays + halfDays;

  // Prefer the per-day wage stored on each row (set for both wage types now);
  // fall back to prorating the monthly salary for legacy rows with no wage.
  const wageRowsTotal = attendance.reduce((sum, a) => sum + (a.wageForDay ?? 0), 0);
  const monthlyProrated =
    staff?.salaryType === "MONTHLY" && staff.monthlySalary ? (staff.monthlySalary / 30) * payableDays : 0;
  const earned =
    wageRowsTotal > 0 ? wageRowsTotal : staff?.salaryType === "MONTHLY" ? monthlyProrated : 0;

  const advanceTotal = advances.reduce((s, a) => s + a.amount, 0);
  const fineTotal = fines.reduce((s, f) => s + f.amount, 0);
  const rewardTotal = rewards.reduce((s, r) => s + r.amount, 0);

  const netBalance = earned + rewardTotal - advanceTotal - fineTotal;

  return {
    staff,
    attendance,
    advances,
    fines,
    rewards,
    presentDays,
    fullDays,
    halfDays,
    payableDays,
    earned,
    advanceTotal,
    fineTotal,
    rewardTotal,
    netBalance,
    runningSalary: earned,
    finalSalary: netBalance,
  };
}

/** Monthly attendance + payroll summary for every active staff member. */
export async function getMonthlyLedgerForAllStaff(year: number, month: number) {
  const staff = await db.staff.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true, designation: true, salaryType: true },
  });
  const rows = await Promise.all(
    staff.map(async (s) => {
      const l = await getStaffLedger(s.id, year, month);
      const presentDays = l.attendance.filter((a) => a.status === "PRESENT").length;
      const halfDays = l.attendance.filter((a) => a.status === "HALF_DAY").length;
      const absentDays = l.attendance.filter((a) => a.status === "ABSENT").length;
      const offDays = l.attendance.filter((a) => a.status === "LEAVE").length;
      return {
        id: s.id,
        name: s.name,
        employeeCode: s.employeeCode,
        designation: s.designation,
        wageType: s.salaryType === "DAILY" ? "Daily" : "Monthly",
        presentDays,
        halfDays,
        absentDays,
        offDays,
        advanceTotal: l.advanceTotal,
        fineTotal: l.fineTotal,
        rewardTotal: l.rewardTotal,
        earned: l.earned,
        netBalance: l.netBalance,
      };
    }),
  );
  return rows;
}

export async function sendDailyAttendanceSummary() {
  const summary = await getTodayAttendanceSummary();
  const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || COMPANY.phones[0])
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const body = dailyAttendanceSummaryMessage({ date: new Date(), ...summary });
  let sent = 0;
  for (const number of adminNumbers) {
    const res = await sendWhatsApp({ kind: "ATTENDANCE_SUMMARY", toNumber: number, body });
    if (res.sent || res.queued) sent += 1;
  }
  return { sent, summary };
}
