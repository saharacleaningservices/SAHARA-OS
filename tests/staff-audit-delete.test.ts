// Overtime edit / delete and attendance "clear day" (2026-10-22): salary recalculates, every change is audited with
// who / when / why, closed months are refused, and only Super Admin / Accounts may do it. Run: npm run test:staffaudit
// Throwaway SQLite DB (scripts/db-setup.mjs); no network. next/cache and the session are stubbed.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-staffaudit-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let money: typeof import("../src/server/actions/staff-money");
let att: typeof import("../src/server/attendance");
let attActions: typeof import("../src/server/actions/attendance");
let balance: typeof import("../src/server/staff-balance");
let staffId = "";
const ADMIN: Session = { sub: "u-admin", name: "Test Admin", email: "admin@t", role: "ADMIN" };
const OPS: Session = { sub: "u-ops", name: "Test Ops", email: "ops@t", role: "OPERATIONS" };

// A date inside the current IST month, so the "this month" salary figure includes it.
const istToday = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const thisMonthDay = `${istToday.slice(0, 8)}01`;

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  money = await import("../src/server/actions/staff-money");
  att = await import("../src/server/attendance");
  attActions = await import("../src/server/actions/attendance");
  balance = await import("../src/server/staff-balance");
  const s = await db.staff.create({ data: { employeeCode: "T-001", name: "Test Worker", mobile: "9000000777", designation: "Cleaning Executive", dailyWage: 800, salaryType: "DAILY" } as never });
  staffId = s.id;
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const salaryDue = async () => (await balance.getStaffMoney(staffId))!.salaryDue;
const audit = (action: string) => db.auditLog.findMany({ where: { entityId: staffId, action }, orderBy: { createdAt: "desc" } });

test("overtime: edit changes the salary due by the difference; delete removes it; both are audited with a reason", async () => {
  session = ADMIN;
  const created = await money.createOvertime({ staffId, date: thisMonthDay, otHours: 2, regularHours: 8, otRate: 100, reason: "late job" });
  assert.ok("ok" in created && created.ok);
  const id = (created as { id: string }).id;
  const base = await salaryDue();
  await money.decideOvertime(id, true);
  const withOt = await salaryDue();
  assert.equal(withOt - base, 200, "approved overtime (2 h x 100) adds to salary due");

  assert.equal((await money.updateOvertime({ id, otHours: 3, otRate: 100, reason: "x" })).error, "Give a reason (3+ characters)");
  const edited = await money.updateOvertime({ id, otHours: 3, otRate: 100, reason: "worker stayed an extra hour" });
  assert.ok("ok" in edited);
  assert.equal((await salaryDue()) - base, 300, "salary due follows the edited amount");
  const [e] = await audit("OT_EDITED");
  const em = JSON.parse(e.meta!);
  assert.equal(e.actorName, "Test Admin");
  assert.equal(em.actorId, "u-admin");
  assert.equal(em.old.otAmount, 200);
  assert.equal(em.next.otAmount, 300);
  assert.equal(em.reason, "worker stayed an extra hour");

  assert.equal((await money.deleteOvertime(id, "")).error, "Give a reason (3+ characters)");
  assert.ok("ok" in (await money.deleteOvertime(id, "entered twice by mistake")));
  assert.equal(await salaryDue(), base, "deleted overtime no longer counts");
  const row = await db.overtimeRecord.findUnique({ where: { id } });
  assert.ok(row?.deletedAt, "soft delete: the row is kept with deletedAt");
  assert.equal(row?.deletedByName, "Test Admin");
  const [d] = await audit("OT_DELETED");
  assert.equal(JSON.parse(d.meta!).old.otAmount, 300);
  assert.equal((await money.deleteOvertime(id, "again please")).error, "Overtime record not found", "cannot delete twice");

  const history = await money.getStaffMoneyAudit(staffId);
  const del = history.find((h) => h.action === "OT_DELETED")!;
  assert.equal(del.next, "Deleted");
  assert.equal(del.reason, "entered twice by mistake");
  assert.ok(history.some((h) => h.action === "OT_EDITED" && h.old && h.next));
});

test("overtime changes are refused for roles without Khata rights and for a closed month", async () => {
  session = ADMIN;
  const c = (await money.createOvertime({ staffId, date: thisMonthDay, otHours: 1, otRate: 50 })) as { id: string };
  session = OPS;
  assert.equal((await money.updateOvertime({ id: c.id, otHours: 2, otRate: 50, reason: "try as ops" })).error, "Not authorized");
  assert.equal((await money.deleteOvertime(c.id, "try as ops")).error, "Not authorized");
  session = null;
  assert.equal((await money.deleteOvertime(c.id, "no session")).error, "Not authorized");
  session = ADMIN;
  const [y, m] = thisMonthDay.split("-").map(Number);
  await db.monthClose.create({ data: { year: y, month: m, closedByName: "Test Admin" } });
  try {
    assert.match((await money.deleteOvertime(c.id, "month is closed")).error ?? "", /is closed/);
    assert.match((await money.updateOvertime({ id: c.id, otHours: 2, otRate: 50, reason: "month is closed" })).error ?? "", /is closed/);
  } finally {
    await db.monthClose.delete({ where: { year_month: { year: y, month: m } } });
  }
});

test("attendance: clearing a day removes it from payable days, keeps a full snapshot in the audit trail", async () => {
  const set = await att.setAttendanceForDate({ staffId, date: thisMonthDay, status: "PRESENT", actorName: "Test Admin" });
  assert.ok("success" in set);
  const before = (await balance.getStaffMoney(staffId))!.month.present;
  assert.equal(before, 1);

  session = OPS;
  assert.equal((await attActions.clearAttendanceDay(staffId, thisMonthDay, "ops cannot clear")).error, "Not authorized");
  session = ADMIN;
  assert.equal((await attActions.clearAttendanceDay(staffId, thisMonthDay, "no")).error, "Give a reason (3+ characters)");
  assert.ok("success" in (await attActions.clearAttendanceDay(staffId, thisMonthDay, "marked for the wrong worker")));
  assert.equal((await balance.getStaffMoney(staffId))!.month.present, 0, "present days recalculated");
  const [a] = await audit("ATTENDANCE_CLEARED");
  const meta = JSON.parse(a.meta!);
  assert.equal(meta.old.status, "PRESENT");
  assert.equal(meta.old.date, thisMonthDay);
  assert.equal(meta.actorId, "u-admin");
  assert.equal(meta.reason, "marked for the wrong worker");
  const trail = await db.attendanceAudit.findFirst({ where: { staffId, newStatus: "CLEARED" } });
  assert.equal(trail?.oldStatus, "PRESENT");
  assert.equal((await attActions.clearAttendanceDay(staffId, thisMonthDay, "already cleared")).error, "That day has no attendance marked");
  const hist = await money.getStaffMoneyAudit(staffId);
  assert.ok(hist.some((h) => h.action === "ATTENDANCE_CLEARED" && h.next === "Cleared (day unmarked)"), "shown in the Audit History tab");
});

test("attendance: a closed month cannot be cleared", async () => {
  await att.setAttendanceForDate({ staffId, date: thisMonthDay, status: "HALF_DAY", actorName: "Test Admin" });
  const [y, m] = thisMonthDay.split("-").map(Number);
  await db.monthClose.create({ data: { year: y, month: m, closedByName: "Test Admin" } });
  try {
    session = ADMIN;
    assert.match((await attActions.clearAttendanceDay(staffId, thisMonthDay, "closed month test")).error ?? "", /is closed/);
    assert.ok(await db.attendance.findFirst({ where: { staffId } }), "nothing was deleted");
  } finally {
    await db.monthClose.delete({ where: { year_month: { year: y, month: m } } });
  }
});
