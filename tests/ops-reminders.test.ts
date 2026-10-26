// Ops reminders + staff self-registration helpers (2026-10-13).
// Run: npm run test:ops   — builds a throwaway SQLite DB with scripts/db-setup.mjs
// (never touches dev.db), seeds fixtures, drives the sweep with a fake clock.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-ops-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

// Loaded in before() — the DB path must be set before the Prisma client is created.
let db: typeof import("../src/lib/db").db;
let ops: typeof import("../src/server/ops-reminders");
let reg: typeof import("../src/server/staff-registration");

const MIN = 60_000;
// 13 Oct 2026, 12:00 IST — outside default quiet hours (21:00–08:00 IST).
const T0 = new Date("2026-10-13T06:30:00Z");
const at = (min: number) => new Date(T0.getTime() + min * MIN);
const day = new Date("2026-10-12T18:30:00Z"); // IST midnight of 13 Oct

let seq = 0;
async function job(data: Partial<{ status: string; scheduledTime: string; jobValue: number; startedAt: Date; completedAt: Date; isDemo: boolean }>) {
  seq += 1;
  return db.job.create({
    data: {
      jobNumber: `T-${seq}`,
      customerName: `Customer ${seq}`,
      customerMobile: "9000000000",
      address: "x",
      area: "x",
      service: "HOME_DEEP_CLEANING" as never,
      scheduledDate: day,
      scheduledTime: data.scheduledTime ?? "8:00 – 10:00 AM",
      status: (data.status ?? "STARTED") as never,
      jobValue: data.jobValue ?? 5000,
      startedAt: data.startedAt ?? null,
      completedAt: data.completedAt ?? null,
      isDemo: data.isDemo ?? false,
    },
  });
}
const notifs = (kind: string) => db.notification.count({ where: { kind } });
const reminder = (kind: string, jobId: string) => db.opsReminder.findUnique({ where: { kind_jobId: { kind, jobId } } });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ops = await import("../src/server/ops-reminders");
  reg = await import("../src/server/staff-registration");
  await db.user.createMany({
    data: [
      { name: "Altaf", email: "admin@t", role: "ADMIN", passwordHash: "x" },
      { name: "Shoyab Kazi", email: "acc@t", role: "ACCOUNTS", passwordHash: "x" },
    ],
  });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("quiet hours and expected finish are computed in IST", () => {
  const s = { quietStart: "21:00", quietEnd: "08:00" };
  assert.equal(ops.inQuietHours(new Date("2026-10-13T16:00:00Z"), s), true); // 21:30 IST
  assert.equal(ops.inQuietHours(new Date("2026-10-13T02:00:00Z"), s), true); // 07:30 IST
  assert.equal(ops.inQuietHours(T0, s), false); // 12:00 IST
  // 8:00 slot + 4 h → 12:00 IST
  assert.equal(ops.jobDueAt({ scheduledDate: day, scheduledTime: "8:00 – 10:00 AM", startedAt: null }, 4).toISOString(), T0.toISOString());
  // Flexible → started + 4 h
  assert.equal(ops.jobDueAt({ scheduledDate: day, scheduledTime: "Flexible", startedAt: at(-60) }, 4).toISOString(), at(180).toISOString());
});

test("first deployment: backlog recorded silently — no alert flood, no instant summary", async () => {
  const old = await job({ status: "COMPLETED", completedAt: at(-10 * 24 * 60), jobValue: 2000 });
  await ops.runOpsReminderSweep(at(-60));
  const r = await reminder("PAYMENT_COLLECTION", old.id);
  assert.equal(r?.status, "OPEN");
  assert.equal(r?.alertCount, 0);
  assert.equal(r?.nextAlertAt.toISOString(), at(-30).toISOString(), "first repeat one interval later");
  assert.equal(await db.notification.count({ where: { kind: { startsWith: "OPS_" } } }), 0, "nothing sent on the first run");
  assert.equal(await db.opsReminderEvent.count({ where: { type: "INITIALIZED" } }), 1);
  // Clear it so the rest of the suite starts clean.
  await db.payment.create({ data: { invoiceNumber: "INV-T-OLD", jobId: old.id, clientName: "c", amount: 2000, paidAmount: 2000, dueDate: at(0), status: "PAID" } });
  await ops.runOpsReminderSweep(at(-59));
  assert.equal((await reminder("PAYMENT_COLLECTION", old.id))?.status, "RESOLVED");
});

test("job closure: alert at due time, repeat every 15 min, no duplicates, never completes the job", async () => {
  const j = await job({ status: "STARTED", startedAt: at(-200) }); // due exactly at T0
  const demo = await job({ status: "STARTED", isDemo: true });
  await ops.runOpsReminderSweep(at(-5));
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.alertCount, 0, "not due yet → no alert");
  assert.equal(await reminder("JOB_CLOSURE", demo.id), null, "demo jobs ignored");

  const [a, b] = await Promise.all([ops.runOpsReminderSweep(at(1)), ops.runOpsReminderSweep(at(1))]);
  assert.ok("skipped" in a || "skipped" in b, "overlapping sweep is skipped");
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.alertCount, 1);
  assert.equal(await notifs("OPS_JOB_CLOSURE"), 1, "one notification for Accounts only");

  await ops.runOpsReminderSweep(at(10));
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.alertCount, 1, "no repeat before 15 min");
  await ops.runOpsReminderSweep(at(16));
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.alertCount, 2, "repeat after 15 min");
  assert.equal((await db.job.findUnique({ where: { id: j.id } }))?.status, "STARTED", "job status never changed");

  // Quiet hours hold alerts.
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { quietStart: "11:00", quietEnd: "23:00" } });
  await ops.runOpsReminderSweep(at(40));
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.alertCount, 2, "held during quiet hours");
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { quietStart: "21:00", quietEnd: "08:00" } });
});

test("escalation to Super Admin once after 2 h; delay reason re-baselines; completion resolves", async () => {
  const j = (await db.job.findFirst({ where: { jobNumber: "T-2" } }))!;
  await ops.runOpsReminderSweep(at(100));
  assert.equal(await notifs("OPS_ESCALATION"), 0, "not yet 2 h");
  await ops.runOpsReminderSweep(at(125));
  assert.equal(await notifs("OPS_ESCALATION"), 1, "escalated");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  assert.equal(await db.notification.count({ where: { kind: "OPS_ESCALATION", userId: admin!.id } }), 1, "to the Super Admin");
  await ops.runOpsReminderSweep(at(200));
  assert.equal(await notifs("OPS_ESCALATION"), 1, "escalates only once");

  // Delay reason: due moves out, no alerts until then.
  await db.opsReminder.update({ where: { kind_jobId: { kind: "JOB_CLOSURE", jobId: j.id } }, data: { delayReason: "Extra work", dueAt: at(300), nextAlertAt: at(300) } });
  const before = (await reminder("JOB_CLOSURE", j.id))!.alertCount;
  await ops.runOpsReminderSweep(at(250));
  assert.equal((await reminder("JOB_CLOSURE", j.id))!.alertCount, before, "silent until the new expected finish");

  // Office marks the job completed (outside the reminder engine) → reminder resolves, payment reminder starts.
  await db.job.update({ where: { id: j.id }, data: { status: "COMPLETED", completedAt: at(260) } });
  await ops.runOpsReminderSweep(at(261));
  assert.equal((await reminder("JOB_CLOSURE", j.id))?.status, "RESOLVED");
  assert.equal((await reminder("PAYMENT_COLLECTION", j.id))?.status, "OPEN");
});

test("payments: unpaid and partial alert every 30 min; paid resolves; follow-up pauses; never marks paid", async () => {
  const unpaid = (await db.job.findFirst({ where: { jobNumber: "T-2" } }))!; // ₹5,000, nothing paid (T-1 is the first-deploy backlog job)
  const partial = await job({ status: "COMPLETED", completedAt: at(250), jobValue: 4000 });
  const paid = await job({ status: "COMPLETED", completedAt: at(250), jobValue: 3000 });
  let inv = 0;
  const pay = (jobId: string, amount: number, paidAmount: number) =>
    db.payment.create({ data: { invoiceNumber: `INV-T-${++inv}`, jobId, clientName: "c", amount, paidAmount, dueDate: at(0), status: paidAmount >= amount ? "PAID" : "PENDING" } });
  await pay(partial.id, 4000, 1500);
  await pay(paid.id, 3000, 3000);

  await ops.runOpsReminderSweep(at(262));
  assert.equal(await reminder("PAYMENT_COLLECTION", paid.id), null, "fully paid job never tracked");
  assert.equal((await reminder("PAYMENT_COLLECTION", partial.id))?.alertCount, 1, "partial balance alerted");
  const n = await db.notification.findFirst({ where: { kind: "OPS_PAYMENT_DUE" }, orderBy: { createdAt: "desc" } });
  assert.match(n!.title + (n!.body ?? ""), /outstanding|balance/i);

  await ops.runOpsReminderSweep(at(280));
  assert.equal((await reminder("PAYMENT_COLLECTION", partial.id))?.alertCount, 1, "no repeat before 30 min");
  await ops.runOpsReminderSweep(at(293));
  assert.equal((await reminder("PAYMENT_COLLECTION", partial.id))?.alertCount, 2, "repeat after 30 min");

  // Valid follow-up pauses reminders (and escalation) until its date.
  const r = (await reminder("PAYMENT_COLLECTION", unpaid.id))!;
  await db.opsReminder.update({ where: { id: r.id }, data: { followUpNote: "Paying Friday", followUpUntil: at(2000), nextAlertAt: at(2000) } });
  const c0 = (await reminder("PAYMENT_COLLECTION", unpaid.id))!.alertCount;
  await ops.runOpsReminderSweep(at(700));
  assert.equal((await reminder("PAYMENT_COLLECTION", unpaid.id))!.alertCount, c0, "paused by follow-up");
  assert.equal((await reminder("PAYMENT_COLLECTION", unpaid.id))!.escalatedAt, null, "no escalation during follow-up");

  // Recording the rest of the payment resolves it; the engine itself never wrote any payment.
  await pay(partial.id, 4000, 2500);
  await ops.runOpsReminderSweep(at(701));
  assert.equal((await reminder("PAYMENT_COLLECTION", partial.id))?.status, "RESOLVED");
  assert.equal(await db.payment.count(), 4, "no payment rows created by reminders");
  assert.equal((await db.job.findUnique({ where: { id: partial.id } }))?.status, "COMPLETED", "work status untouched");
});

test("daily summary goes out once per IST day", async () => {
  assert.equal(await notifs("OPS_DAILY_SUMMARY"), 0, "deployment day is skipped (first run marks it done)");
  await ops.runOpsReminderSweep(at(24 * 60 + 1)); // next IST day, 12:01
  assert.equal(await notifs("OPS_DAILY_SUMMARY"), 2, "one row each for Admin + Accounts");
  await ops.runOpsReminderSweep(at(24 * 60 + 2));
  assert.equal(await notifs("OPS_DAILY_SUMMARY"), 2, "not repeated the same day");
});

test("staff registration: only active staff numbers without a login are eligible", async () => {
  await db.staff.createMany({
    data: [
      { employeeCode: "SCS-901", name: "Eligible", mobile: "+91 98765 43210", designation: "Cleaner" },
      { employeeCode: "SCS-902", name: "Disabled", mobile: "9876500002", designation: "Cleaner", isActive: false },
      { employeeCode: "SCS-903", name: "Removed", mobile: "9876500003", designation: "Cleaner", deletedAt: new Date() },
    ],
  });
  assert.equal(await reg.findRegistrableStaff("9999999999"), null, "unknown number");
  assert.equal(await reg.findRegistrableStaff("9876500002"), null, "disabled staff");
  assert.equal(await reg.findRegistrableStaff("9876500003"), null, "deleted staff");
  const s = await reg.findRegistrableStaff("09876543210");
  assert.equal(s?.employeeCode, "SCS-901");
  const res = await reg.createStaffLogin(s!, "hash");
  assert.ok("userId" in res);
  const u = await db.user.findUnique({ where: { id: (res as { userId: string }).userId } });
  assert.equal(u?.role, "STAFF");
  assert.equal(u?.phone, "9876543210");
  assert.equal(await reg.findRegistrableStaff("9876543210"), null, "already has a login → cannot register again");
  // Disabling the login never re-opens registration.
  await db.user.update({ where: { id: u!.id }, data: { isActive: false } });
  assert.equal(await reg.findRegistrableStaff("9876543210"), null, "disabled login cannot re-register");
});
