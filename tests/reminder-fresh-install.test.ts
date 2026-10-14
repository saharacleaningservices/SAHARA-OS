// Fresh-install behaviour of the new reminder kinds + EOD timing (2026-10-14).
// Run: npm run test:eod — fresh throwaway SQLite DB, fake clock, never dev.db.
//
//  - An empty baseline still counts as "baseline done": the first item that becomes overdue later is a
//    normal (non-backlog) reminder and alerts immediately.
//  - EOD: deploying (or restarting) after the 18:30 IST cut-off must not fire a surprise summary. The very
//    first run only records today as the baseline; a sweep later than the grace window skips that day;
//    a sweep inside the grace window still delivers it. The next day's summary is never lost.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-fresh-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let ops: typeof import("../src/server/ops-reminders");

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const ist = (day: number, hhmm: string) => new Date(new Date(`2026-10-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`).getTime());
const count = (kind: string, where: object = {}) => db.notification.count({ where: { kind, ...where } });
const eodEvents = (type: string) => db.opsReminderEvent.count({ where: { type } });
const lastEodDay = async () => (await db.opsReminderSettings.findUnique({ where: { id: "default" } }))!.lastEodSummaryDay;

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ops = await import("../src/server/ops-reminders");
  await db.user.create({ data: { name: "Altaf", email: "admin@t", role: "ADMIN", passwordHash: "x" } });
  await db.user.create({ data: { name: "Shoyab Kazi", email: "acc@t", role: "ACCOUNTS", passwordHash: "x" } });
  await db.opsReminderEvent.create({ data: { type: "INITIALIZED", note: "seed" } });
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { dailySummaryHour: -1, eodSummaryTime: "18:30" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("empty baseline still completes: a later overdue quotation is a normal reminder, not backlog", async () => {
  await ops.runOpsReminderSweep(ist(14, "12:00")); // nothing overdue yet
  assert.equal(await eodEvents("BASELINE_QUOTATION_FOLLOWUP"), 1);
  assert.equal(await eodEvents("BASELINE_FOLLOWUP_DUE"), 1);
  const lead = await db.lead.create({ data: { leadNumber: "LD-F-1", name: "L", mobile: "9000000000", area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, stage: "QUOTATION" as never } });
  const q = await db.quotation.create({ data: { quoteNumber: "QT-F-1", leadId: lead.id, services: "[]", subTotal: 5000, totalAmount: 5000, terms: "x", status: "SENT" as never, createdAt: new Date(ist(14, "12:00").getTime() - 3 * DAY) } });
  await ops.runOpsReminderSweep(ist(14, "12:05"));
  const r = (await db.opsReminder.findUnique({ where: { kind_jobId: { kind: ops.QUOTATION_KIND, jobId: `Q:${q.id}` } } }))!;
  assert.equal(r.isBacklog, false);
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP"), 1, "alerts immediately — legitimate new overdue item is not suppressed");
});

test("EOD: first run after the cut-off only records a baseline (no surprise summary); the next day sends normally", async () => {
  assert.equal(await lastEodDay(), null);
  const r = await ops.runOpsReminderSweep(ist(14, "19:10")); // "deployed" after 18:30
  assert.ok("eodSummary" in r && r.eodSummary === false);
  assert.equal(await count("OPS_EOD_SUMMARY"), 0);
  assert.equal(await lastEodDay(), "2026-10-14");
  assert.equal(await eodEvents("EOD_SKIPPED"), 1);
  await ops.runOpsReminderSweep(ist(14, "19:20")); // same day again → still nothing, no second skip log
  assert.equal(await count("OPS_EOD_SUMMARY"), 0);
  assert.equal(await eodEvents("EOD_SKIPPED"), 1);
  await ops.runOpsReminderSweep(ist(15, "18:35")); // tomorrow → the first real EOD
  assert.equal(await count("OPS_EOD_SUMMARY"), 2); // Admin + Accounts
  assert.equal(await lastEodDay(), "2026-10-15");
});

test("EOD: a sweep later than the grace window skips that day only; the next day is not lost", async () => {
  assert.equal(ops.EOD_GRACE_MIN, 120);
  await ops.runOpsReminderSweep(ist(16, "20:45")); // 18:30 + 2 h = 20:30 → too late
  assert.equal(await count("OPS_EOD_SUMMARY"), 2);
  assert.equal(await eodEvents("EOD_SKIPPED"), 2);
  assert.equal(await lastEodDay(), "2026-10-16");
  await ops.runOpsReminderSweep(ist(16, "20:50")); // no late send afterwards
  assert.equal(await count("OPS_EOD_SUMMARY"), 2);
  await ops.runOpsReminderSweep(ist(17, "18:31"));
  assert.equal(await count("OPS_EOD_SUMMARY"), 4);
});

test("EOD: a delayed sweep inside the grace window still delivers the summary exactly once", async () => {
  await ops.runOpsReminderSweep(ist(18, "19:50")); // 80 min late (server restart / brief outage)
  assert.equal(await count("OPS_EOD_SUMMARY"), 6);
  await ops.runOpsReminderSweep(ist(18, "19:55"));
  await ops.runOpsReminderSweep(ist(18, "20:10"));
  assert.equal(await count("OPS_EOD_SUMMARY"), 6, "no duplicate on repeat sweeps");
  assert.equal(await eodEvents("EOD_SKIPPED"), 2, "nothing skipped on a within-grace delivery");
});

test("EOD: switching it off ('off') sends nothing and skipping rules are not triggered", async () => {
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { eodSummaryTime: "off" } });
  await ops.runOpsReminderSweep(ist(19, "18:40"));
  assert.equal(await count("OPS_EOD_SUMMARY"), 6);
  assert.equal(await eodEvents("EOD_SKIPPED"), 2);
});
