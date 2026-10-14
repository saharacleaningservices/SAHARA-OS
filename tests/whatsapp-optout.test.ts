// WhatsApp STOP suppression, duplicate prevention and TEST-mode gate for broadcasts. Run: npm run test:whatsapp
// Fresh throwaway SQLite DB (scripts/db-setup.mjs). No network: the outbound gate blocks every non-approved number
// before any Cloud API call, and all credentials are cleared for this process.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "../src/lib/whatsapp-keywords";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-wa-optout-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.WHATSAPP_OUTBOUND_MODE = "test";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_APP_SECRET"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let wa: typeof import("../src/lib/whatsapp");
let bc: typeof import("../src/server/whatsapp-broadcast");

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  wa = await import("../src/lib/whatsapp");
  bc = await import("../src/server/whatsapp-broadcast");
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("STOP / START keywords match only the whole message; CANCEL is never an opt-out", () => {
  for (const t of ["STOP", "stop", " Stop ", "unsubscribe", "Opt out", "optout"]) assert.ok(OPT_OUT_KEYWORDS.test(t.trim()), t);
  for (const t of ["please stop calling", "stop it now", "CANCEL", "cancel my booking", "stopping"]) assert.equal(OPT_OUT_KEYWORDS.test(t.trim()), false, t);
  for (const t of ["START", "subscribe", "Opt in"]) assert.ok(OPT_IN_KEYWORDS.test(t.trim()), t);
});

test("an opt-out is remembered in any number format, and only for that number", async () => {
  await wa.setWhatsAppOptOut("+91 98200 00001", "CUSTOMER_REPLY");
  assert.equal(await wa.isOptedOut("9820000001"), true);
  assert.equal(await wa.isOptedOut("919820000001"), true);
  assert.equal(await wa.isOptedOut("09820000001"), true);
  assert.equal(await wa.isOptedOut("9820000002"), false);
});

test("broadcast: opted-out numbers are skipped, duplicates are sent once, nothing reaches a non-approved number in TEST mode", async () => {
  const campaign = "unit_test_campaign";
  const mk = (mobile: string) => ({ mobile, name: "T", params: ["T", "x"] });
  const started = bc.startBroadcastJob({
    campaign,
    templateName: "sahara_customer_reactivation",
    perMinute: 100,
    recipients: [mk("9820000001"), mk("9820000002"), mk("9820000002")],
    startedBy: "unit-test",
  });
  assert.equal(started, true);
  for (let i = 0; i < 100 && bc.getBroadcastJob()?.status === "RUNNING"; i++) await new Promise((r) => setTimeout(r, 100));
  const job = bc.getBroadcastJob()!;
  assert.equal(job.status, "DONE");
  assert.equal(job.total, 3);
  assert.equal(job.sent, 0, "nothing is actually sent in TEST mode to a non-approved number");
  assert.equal(job.failed, 1, "the one eligible number is attempted once and blocked by the TEST-mode gate");
  assert.equal(job.skipped, 2, "the opted-out number and the duplicate are both skipped");
  const rows = await db.whatsAppMessage.findMany({ where: { relatedType: "Campaign", relatedId: campaign } });
  assert.equal(rows.length, 1, "exactly one audit row; none for the opted-out number");
  assert.equal(rows[0].status, "CANCELLED");
  assert.match(rows[0].errorMessage ?? "", /TEST MODE/);
});

test("only one broadcast may run at a time", async () => {
  const mk = (mobile: string) => ({ mobile, name: "T", params: ["T", "x"] });
  assert.equal(bc.startBroadcastJob({ campaign: "unit_test_two", templateName: "sahara_customer_reactivation", perMinute: 50, recipients: [mk("9820000003"), mk("9820000004")], startedBy: "u" }), true);
  assert.equal(bc.startBroadcastJob({ campaign: "unit_test_three", templateName: "sahara_customer_reactivation", perMinute: 50, recipients: [mk("9820000005")], startedBy: "u" }), false);
  bc.stopBroadcastJob();
  for (let i = 0; i < 100 && bc.getBroadcastJob()?.status === "RUNNING"; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(bc.getBroadcastJob()!.status, "STOPPED");
});
