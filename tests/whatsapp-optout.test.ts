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

// ── Marketing-template consent guard (sendWhatsAppTemplate) ─────────────────────────────────────────────────────
// LIVE mode + no credentials: a number that passes every gate reaches the "not connected" check and stops there — no network.
const lead = (mobile: string, consent: "OPTED_IN" | "OPTED_OUT" | "UNKNOWN") =>
  db.lead.create({ data: { leadNumber: `LD-T-${mobile}`, name: "Priya Sharma", mobile, whatsapp: mobile, area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, marketingConsent: consent as never } });

async function sendLive(template: string, mobile: string) {
  const prev = process.env.WHATSAPP_OUTBOUND_MODE;
  process.env.WHATSAPP_OUTBOUND_MODE = "live";
  try {
    return await wa.sendWhatsAppTemplate({ kind: "OTHER", toNumber: mobile, templateName: template, languageCode: "en", bodyParams: ["T", "x"], preview: "p" });
  } finally {
    process.env.WHATSAPP_OUTBOUND_MODE = prev;
  }
}

test("marketing template: refused without a recorded opt-in (UNKNOWN, no lead at all, opted-out lead, STOP reply), audited as CANCELLED", async () => {
  await lead("9820000011", "UNKNOWN");
  await lead("9820000013", "OPTED_OUT");
  await lead("9820000014", "OPTED_IN");
  await wa.setWhatsAppOptOut("9820000014", "CUSTOMER_REPLY"); // STOP beats an earlier opt-in
  for (const m of ["9820000011", "9820000012", "9820000013", "9820000014"]) {
    const r = await sendLive("sahara_customer_reactivation", m);
    assert.equal(r.sent, false, m);
    assert.match(r.error ?? "", /opt/i, m);
  }
  const rows = await db.whatsAppMessage.findMany({ where: { templateName: "sahara_customer_reactivation", toNumber: { in: ["919820000011", "919820000012", "919820000013"] } } });
  assert.ok(rows.length >= 3 && rows.every((r) => r.status === "CANCELLED"), "refusals are written to the log");
});

test("marketing template: a recorded opt-in passes the consent gate (and stops at 'not connected' here — nothing is sent)", async () => {
  await lead("9820000015", "OPTED_IN");
  const r = await sendLive("sahara_customer_reactivation", "9820000015");
  assert.equal(r.sent, false);
  assert.match(r.error ?? "", /not connected/i, "consent was accepted; only the missing credentials stopped it");
});

test("utility (transactional) templates are not blocked by the marketing-consent guard", async () => {
  const r = await sendLive("sahara_booking_confirmed", "9820000016"); // no consent record at all
  assert.equal(r.sent, false);
  assert.match(r.error ?? "", /not connected/i, "transactional booking messages never need marketing consent");
});

test("the approved QA number is exempt from the marketing-consent guard", async () => {
  const r = await sendLive("sahara_customer_reactivation", "9921215250");
  assert.match(r.error ?? "", /not connected/i);
});
