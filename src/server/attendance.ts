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

  const presentDays = attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const earnedFromAttendance = attendance.reduce((sum, a) => sum + (a.wageForDay ?? 0), 0);
  const monthlyProrated =
    staff?.salaryType === "MONTHLY" && staff.monthlySalary ? (staff.monthlySalary / 30) * presentDays : 0;
  const earned = staff?.salaryType === "DAILY" ? earnedFromAttendance : monthlyProrated;

  const advanceTotal = advances.reduce((s, a) => s + a.amount, 0);
  const fineTotal = fines.reduce((s, f) => s + f.amount, 0);
  const rewardTotal = rewards.reduce((s, r) => s + r.amount, 0);

  const netBalance = earned + rewardTotal - advanceTotal - fineTotal;

  return { staff, attendance, advances, fines, rewards, presentDays, earned, advanceTotal, fineTotal, rewardTotal, netBalance };
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
