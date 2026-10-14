// Backlog / baseline handling for quotation + customer follow-up reminders (2026-10-14).
// Run: npm run test:eod — fresh throwaway SQLite DB (scripts/db-setup.mjs), fake clock, never dev.db.
//
// Rule under test: the first sweep after a reminder kind goes live records everything ALREADY overdue as
// "backlog" — silent, first repeat one interval later, never escalated to the Super Admin. Anything that
// becomes overdue after that baseline is a normal reminder (alerts at once, escalates after 2 h).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-baseline-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let ops: typeof import("../src/server/ops-reminders");

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NOON = new Date("2026-10-14T06:30:00Z"); // 12:00 IST
const at = (min: number) => new Date(NOON.getTime() + min * MIN);

let seq = 0;
async function lead() {
  seq += 1;
  return db.lead.create({ data: { leadNumber: `LD-B-${seq}`, name: `Lead ${seq}`, mobile: "9000000000", area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, stage: "QUOTATION" as never } });
}
async function quote(leadId: string, ageDays: number) {
  seq += 1;
  return db.quotation.create({ data: { quoteNumber: `QT-B-${seq}`, leadId, services: "[]", subTotal: 5000, totalAmount: 5000, terms: "x", status: "SENT" as never, createdAt: new Date(NOON.getTime() - ageDays * DAY) } });
}
const followUp = (leadId: string, ageDays: number) => db.followUp.create({ data: { leadId, dueDate: new Date(NOON.getTime() - ageDays * DAY), type: "CALL" as never } });
const count = (kind: string, where: object = {}) => db.notification.count({ where: { kind, ...where } });
const reminder = (kind: string, key: string) => db.opsReminder.findUnique({ where: { kind_jobId: { kind, jobId: key } } });

let admin: { id: string };
let accounts: { id: string };
const backlogIds: string[] = [];

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ops = await import("../src/server/ops-reminders");
  admin = await db.user.create({ data: { name: "Altaf", email: "admin@t", role: "ADMIN", passwordHash: "x" } });
  accounts = await db.user.create({ data: { name: "Shoyab Kazi", email: "acc@t", role: "ACCOUNTS", passwordHash: "x" } });
  await db.opsReminderEvent.create({ data: { type: "INITIALIZED", note: "seed — job/payment reminders already live" } });
  await db.opsReminderSettings.update({ where: { id: "default" }, data: { dailySummaryHour: -1, eodSummaryTime: "off" } });
  // Pre-existing reminder data that must survive every sweep untouched.
  const old = await db.opsReminder.create({ data: { kind: "JOB_CLOSURE", jobId: "old-job", status: "RESOLVED", dueAt: at(-5000), nextAlertAt: at(-5000), resolvedAt: at(-4000), resolvedReason: "Job marked completed" } });
  await db.opsReminderEvent.create({ data: { reminderId: old.id, type: "RESOLVED", note: "kept" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("historical backlog is recorded silently, flagged, and never escalated", async () => {
  const l = await lead();
  const qs = [await quote(l.id, 10), await quote(l.id, 20), await quote(l.id, 40)];
  const fs = [await followUp(l.id, 5), await followUp(l.id, 12)];
  await ops.runOpsReminderSweep(NOON);
  for (const q of qs) {
    const r = await reminder(ops.QUOTATION_KIND, `Q:${q.id}`);
    assert.ok(r && r.isBacklog === true && r.status === "OPEN" && r.escalatedAt === null);
    backlogIds.push(r.id);
  }
  for (const f of fs) {
    const r = await reminder(ops.FOLLOWUP_KIND, `F:${f.id}`);
    assert.ok(r && r.isBacklog === true);
    backlogIds.push(r.id);
  }
  // Silent at go-live: no alerts, no escalation; baseline recorded as events.
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP"), 0);
  assert.equal(await count("OPS_FOLLOWUP_DUE"), 0);
  assert.equal(await count("OPS_ESCALATION"), 0);
  assert.equal(await db.opsReminderEvent.count({ where: { type: "BASELINE_QUOTATION_FOLLOWUP" } }), 1);
  assert.equal(await db.opsReminderEvent.count({ where: { type: "BASELINE_FOLLOWUP_DUE" } }), 1);

  // 3 h later (past the 2 h escalation window): repeats go to Accounts only — combined, one per kind — and nothing escalates.
  await ops.runOpsReminderSweep(at(180));
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP", { userId: accounts.id }), 1);
  assert.equal(await count("OPS_FOLLOWUP_DUE", { userId: accounts.id }), 1);
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP", { userId: admin.id }), 0);
  assert.equal(await count("OPS_ESCALATION"), 0);
  assert.equal(await db.opsReminder.count({ where: { id: { in: backlogIds }, escalatedAt: { not: null } } }), 0);

  // Repeat sweeps inside the interval never duplicate.
  await ops.runOpsReminderSweep(at(181));
  await ops.runOpsReminderSweep(at(200));
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP"), 1);
  assert.equal(await count("OPS_FOLLOWUP_DUE"), 1);
  assert.equal(await db.opsReminderEvent.count({ where: { type: "BASELINE_QUOTATION_FOLLOWUP" } }), 1); // baseline runs once
});

test("an item that becomes overdue AFTER the baseline alerts at once and escalates once after 2 h", async () => {
  const l = await lead();
  const q = await quote(l.id, 3); // 3 days old → needs follow-up, but it is NOT backlog
  const T = at(240); // 16:00 IST
  await ops.runOpsReminderSweep(T);
  const r = (await reminder(ops.QUOTATION_KIND, `Q:${q.id}`))!;
  assert.equal(r.isBacklog, false);
  assert.equal(await count("OPS_QUOTATION_FOLLOWUP"), 2, "normal reminder alerts immediately (backlog repeat was the first)");
  // Not yet 2 h → no escalation.
  await ops.runOpsReminderSweep(at(240 + 60));
  assert.equal(await count("OPS_ESCALATION"), 0);
  // 2 h+ → exactly one escalation to the Super Admin, and only for the new item.
  await ops.runOpsReminderSweep(at(240 + 125));
  assert.equal(await count("OPS_ESCALATION", { userId: admin.id }), 1);
  assert.ok((await reminder(ops.QUOTATION_KIND, `Q:${q.id}`))!.escalatedAt);
  assert.equal(await db.opsReminder.count({ where: { id: { in: backlogIds }, escalatedAt: { not: null } } }), 0, "backlog still never escalated");
  await ops.runOpsReminderSweep(at(240 + 130));
  await ops.runOpsReminderSweep(at(240 + 140));
  assert.equal(await count("OPS_ESCALATION"), 1, "no repeat escalation");
});

test("backlog items still resolve normally and existing reminder/event data is preserved", async () => {
  const one = (await db.opsReminder.findMany({ where: { id: { in: backlogIds }, kind: ops.QUOTATION_KIND } }))[0];
  await db.quotation.update({ where: { id: one.quotationId! }, data: { status: "REJECTED" } });
  await ops.runOpsReminderSweep(at(500));
  const after = (await db.opsReminder.findUnique({ where: { id: one.id } }))!;
  assert.equal(after.status, "RESOLVED");
  assert.match(after.resolvedReason ?? "", /rejected/i);
  const kept = await db.opsReminder.findUnique({ where: { kind_jobId: { kind: "JOB_CLOSURE", jobId: "old-job" } } });
  assert.ok(kept && kept.status === "RESOLVED" && kept.resolvedReason === "Job marked completed");
  assert.equal(await db.opsReminderEvent.count({ where: { type: "RESOLVED", note: "kept" } }), 1);
  assert.equal(await db.opsReminderEvent.count({ where: { type: "INITIALIZED" } }), 1);
});
