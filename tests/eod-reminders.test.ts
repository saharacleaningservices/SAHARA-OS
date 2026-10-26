// EOD summary, quotation + customer follow-up reminders, per-user alert preferences (2026-10-14).
// Run: npm run test:eod   — builds a throwaway SQLite DB with scripts/db-setup.mjs (never touches
// dev.db) and drives the sweep with a fake clock. Existing job / payment behaviour is covered by
// tests/ops-reminders.test.ts (npm run test:ops).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-eod-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
const setup = () => execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
setup();

let db: typeof import("../src/lib/db").db;
let ops: typeof import("../src/server/ops-reminders");

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
// 14 Oct 2026, 12:00 IST — outside quiet hours (21:00–08:00) and before the 18:30 EOD time.
const NOON = new Date("2026-10-14T06:30:00Z");
const at = (min: number) => new Date(NOON.getTime() + min * MIN);

let seq = 0;
async function lead(stage = "QUOTATION") {
  seq += 1;
  return db.lead.create({
    data: { leadNumber: `LD-T-${seq}`, name: `Lead ${seq}`, mobile: "9000000000", area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, stage: stage as never },
  });
}
async function quote(leadId: string, createdAt: Date, status = "SENT", total = 8000) {
  seq += 1;
  return db.quotation.create({ data: { quoteNumber: `QT-T-${seq}`, leadId, services: "[]", subTotal: total, totalAmount: total, terms: "x", status: status as never, createdAt } });
}
const followUp = (leadId: string, dueDate: Date) => db.followUp.create({ data: { leadId, dueDate, type: "CALL" as never } });
const rem = (kind: string, key: string) => db.opsReminder.findUnique({ where: { kind_jobId: { kind, jobId: key } } });
const notifs = (kind: string, where: object = {}) => db.notification.count({ where: { kind, ...where } });

let admin: { id: string; name: string };
let accounts: { id: string; name: string };

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ops = await import("../src/server/ops-reminders");
  admin = await db.user.create({ data: { name: "Altaf", email: "admin@t", role: "ADMIN", passwordHash: "x" } });
  accounts = await db.user.create({ data: { name: "Shoyab Kazi", email: "acc@t", role: "ACCOUNTS", passwordHash: "x" } });
  // Not "first deployment": a prior reminder event exists, like production after the job/payment reminders went live.
  await db.opsReminderEvent.create({ data: { type: "INITIALIZED", note: "seed" } });
  // Keep the daily/EOD summaries out of the way until a test asks for them.
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { dailySummaryHour: -1, eodSummaryTime: "off" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("migration is idempotent and the new columns exist with safe defaults", async () => {
  setup(); // second run must not fail
  const u = await db.user.findUnique({ where: { id: accounts.id }, select: { soundEnabled: true, notificationsEnabled: true } });
  assert.deepEqual(u, { soundEnabled: true, notificationsEnabled: true });
  const s = await ops.getOpsSettings();
  assert.equal(s.quotationFollowUpDays, 2);
  assert.equal(s.followUpIntervalMin, 120);
  assert.equal(ops.parseEodTime("18:30"), 18 * 60 + 30);
  assert.equal(ops.parseEodTime("off"), null);
  assert.equal(ops.parseEodTime("25:99"), null);
});

test("quotation reminders: old SENT quote tracked silently, then repeats to Accounts only; fresh/decided quotes ignored", async () => {
  const l = await lead();
  const old = await quote(l.id, new Date(NOON.getTime() - 3 * DAY));
  const fresh = await quote(l.id, new Date(NOON.getTime() - 1 * DAY));
  const rejected = await quote(l.id, new Date(NOON.getTime() - 5 * DAY), "REJECTED");
  await ops.runOpsReminderSweep(NOON);
  const r = await rem(ops.QUOTATION_KIND, `Q:${old.id}`);
  assert.ok(r && r.status === "OPEN" && r.quotationId === old.id);
  assert.equal(await rem(ops.QUOTATION_KIND, `Q:${fresh.id}`), null);
  assert.equal(await rem(ops.QUOTATION_KIND, `Q:${rejected.id}`), null);
  // First deployment of this kind → silent: first alert one interval later.
  assert.equal(await notifs("OPS_QUOTATION_FOLLOWUP"), 0);
  assert.ok(r.nextAlertAt.getTime() > NOON.getTime());
  await ops.runOpsReminderSweep(at(125));
  assert.equal(await notifs("OPS_QUOTATION_FOLLOWUP", { userId: accounts.id }), 1);
  assert.equal(await notifs("OPS_QUOTATION_FOLLOWUP", { userId: admin.id }), 0);
});

test("acknowledge / snooze never touch the quotation; only a status change resolves the reminder", async () => {
  const l = await lead();
  const q = await quote(l.id, new Date(NOON.getTime() - 4 * DAY));
  await ops.runOpsReminderSweep(at(130));
  const r = (await rem(ops.QUOTATION_KIND, `Q:${q.id}`))!;
  // Same writes the acknowledge / snooze actions perform:
  await db.opsReminder.update({ where: { id: r.id }, data: { acknowledgedAt: new Date(), acknowledgedBy: "Shoyab Kazi", snoozedUntil: at(400), nextAlertAt: at(400) } });
  await ops.runOpsReminderSweep(at(140));
  assert.equal((await rem(ops.QUOTATION_KIND, `Q:${q.id}`))!.status, "OPEN");
  assert.equal((await db.quotation.findUnique({ where: { id: q.id } }))!.status, "SENT");
  await db.quotation.update({ where: { id: q.id }, data: { status: "ACCEPTED" } });
  await ops.runOpsReminderSweep(at(150));
  const done = (await rem(ops.QUOTATION_KIND, `Q:${q.id}`))!;
  assert.equal(done.status, "RESOLVED");
  assert.match(done.resolvedReason ?? "", /accepted/i);
});

test("follow-up reminders: overdue tracked, cancelled lead ignored, closed only when marked done", async () => {
  const l = await lead("NEGOTIATION");
  const f = await followUp(l.id, new Date(NOON.getTime() - 3 * 60 * MIN));
  const future = await followUp(l.id, new Date(NOON.getTime() + 5 * 60 * MIN));
  const dead = await lead("CANCELLED");
  const ignored = await followUp(dead.id, new Date(NOON.getTime() - 3 * 60 * MIN));
  await ops.runOpsReminderSweep(at(160));
  const r = (await rem(ops.FOLLOWUP_KIND, `F:${f.id}`))!;
  assert.ok(r && r.status === "OPEN" && r.followUpId === f.id);
  assert.equal(await rem(ops.FOLLOWUP_KIND, `F:${future.id}`), null);
  assert.equal(await rem(ops.FOLLOWUP_KIND, `F:${ignored.id}`), null);
  // Ack + snooze leave the CRM follow-up untouched.
  await db.opsReminder.update({ where: { id: r.id }, data: { acknowledgedAt: new Date(), snoozedUntil: at(500), nextAlertAt: at(500) } });
  await ops.runOpsReminderSweep(at(170));
  assert.equal((await db.followUp.findUnique({ where: { id: f.id } }))!.isDone, false);
  assert.equal((await rem(ops.FOLLOWUP_KIND, `F:${f.id}`))!.status, "OPEN");
  await db.followUp.update({ where: { id: f.id }, data: { isDone: true, doneAt: new Date() } });
  await ops.runOpsReminderSweep(at(180));
  const done = (await rem(ops.FOLLOWUP_KIND, `F:${f.id}`))!;
  assert.equal(done.status, "RESOLVED");
  assert.match(done.resolvedReason ?? "", /done/i);
});

test("EOD summary reads live data; fires once per IST day at the configured time for Admin + Accounts", async () => {
  const l = await lead();
  await quote(l.id, new Date(NOON.getTime() - 3 * DAY), "SENT", 12000);
  await followUp(l.id, new Date(NOON.getTime() - 60 * MIN));
  const summary = await ops.getEodSummary(NOON);
  assert.ok(summary.openQuotations.count >= 1 && summary.openQuotations.total >= 12000);
  assert.ok(summary.overdueFollowUps.count >= 1);
  assert.ok(ops.eodTotal(summary) >= 2);

  await db.opsReminderSettings.update({ where: { id: "default" }, data: { eodSummaryTime: "18:30", lastEodSummaryDay: "2026-10-13" } });
  await ops.runOpsReminderSweep(NOON); // 12:00 IST — too early
  assert.equal(await notifs("OPS_EOD_SUMMARY"), 0);
  const evening = new Date("2026-10-14T13:05:00Z"); // 18:35 IST
  const r1 = await ops.runOpsReminderSweep(evening);
  assert.ok("eodSummary" in r1 && r1.eodSummary === true);
  assert.equal(await notifs("OPS_EOD_SUMMARY", { userId: admin.id }), 1);
  assert.equal(await notifs("OPS_EOD_SUMMARY", { userId: accounts.id }), 1);
  await ops.runOpsReminderSweep(new Date(evening.getTime() + 10 * MIN)); // same day → no repeat
  assert.equal(await notifs("OPS_EOD_SUMMARY"), 2);
  const next = new Date(evening.getTime() + DAY); // next IST day → fires again
  await ops.runOpsReminderSweep(next);
  assert.equal(await notifs("OPS_EOD_SUMMARY"), 4);
});

test("EOD acknowledge marks only the notification seen and records who/when; nothing in the CRM changes", async () => {
  const quotesBefore = await db.quotation.count({ where: { status: "SENT" } });
  const openBefore = await db.opsReminder.count({ where: { status: "OPEN" } });
  const n = await ops.acknowledgeEod({ id: accounts.id, name: accounts.name });
  assert.ok(n >= 1);
  assert.equal(await notifs("OPS_EOD_SUMMARY", { userId: accounts.id, readAt: null }), 0);
  assert.equal(await db.quotation.count({ where: { status: "SENT" } }), quotesBefore);
  assert.equal(await db.opsReminder.count({ where: { status: "OPEN" } }), openBefore);
  const ev = await db.opsReminderEvent.findFirst({ where: { type: "EOD_ACK", userId: accounts.id } });
  assert.ok(ev && ev.actorName === "Shoyab Kazi" && ev.createdAt instanceof Date);
});

test("per-user sound / notifications are independent, audited with userId, and never stop tracking", async () => {
  const openBefore = await db.opsReminder.count({ where: { status: "OPEN" } });
  const a = await ops.setUserReminderPrefs(accounts, { soundEnabled: false });
  assert.deepEqual(a, { soundEnabled: false, notificationsEnabled: true });
  const b = await ops.setUserReminderPrefs(accounts, { notificationsEnabled: false });
  assert.deepEqual(b, { soundEnabled: false, notificationsEnabled: false });
  // The other user is unaffected.
  const adminPrefs = await db.user.findUnique({ where: { id: admin.id }, select: { soundEnabled: true, notificationsEnabled: true } });
  assert.deepEqual(adminPrefs, { soundEnabled: true, notificationsEnabled: true });
  assert.equal(await ops.setUserReminderPrefs(accounts, {}), null);
  const events = await db.opsReminderEvent.findMany({ where: { type: "PREF_CHANGE", userId: accounts.id }, orderBy: { createdAt: "asc" } });
  assert.equal(events.length, 2);
  assert.match(events[0].note ?? "", /sound OFF/);
  assert.match(events[1].note ?? "", /notifications OFF/);

  // Notifications OFF: reminders keep being generated and the in-app row is still written (silent, unread).
  const l = await lead();
  const q = await quote(l.id, new Date(NOON.getTime() - 6 * DAY));
  const before = await notifs("OPS_QUOTATION_FOLLOWUP", { userId: accounts.id });
  const T16 = new Date("2026-10-16T06:30:00Z"); // 12:00 IST, after every earlier fake-clock step
  await ops.runOpsReminderSweep(T16);
  const r = await rem(ops.QUOTATION_KIND, `Q:${q.id}`);
  assert.ok(r && r.status === "OPEN");
  assert.ok((await db.opsReminder.count({ where: { status: "OPEN" } })) >= openBefore);
  await db.opsReminder.update({ where: { id: r.id }, data: { nextAlertAt: T16 } });
  await ops.runOpsReminderSweep(new Date(T16.getTime() + MIN));
  assert.ok((await notifs("OPS_QUOTATION_FOLLOWUP", { userId: accounts.id })) > before);
  // Turning notifications back on restores the preference.
  assert.deepEqual(await ops.setUserReminderPrefs(accounts, { notificationsEnabled: true, soundEnabled: true }), { soundEnabled: true, notificationsEnabled: true });
});

test("existing job / payment reminder rows are untouched by the new kinds", async () => {
  const rows = await db.opsReminder.findMany({ where: { kind: { in: ["JOB_CLOSURE", "PAYMENT_COLLECTION"] } } });
  assert.equal(rows.length, 0); // none were created by the quotation / follow-up sweeps
  const kinds = new Set((await db.opsReminder.findMany({ select: { kind: true } })).map((r) => r.kind));
  assert.deepEqual([...kinds].sort(), [ops.FOLLOWUP_KIND, ops.QUOTATION_KIND].sort());
});
