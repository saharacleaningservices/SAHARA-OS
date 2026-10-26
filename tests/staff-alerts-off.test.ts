// Staff WhatsApp alerts off + stale-queue guard (owner 2026-10-25). Throwaway SQLite DB; fake numbers; no network
// (every row here is cancelled before any Meta call). Run: npm run test:staffalerts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-staffalerts-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.WHATSAPP_OUTBOUND_MODE = "live";
process.env.WHATSAPP_ACCESS_TOKEN = "test-token-not-real";
process.env.WHATSAPP_PHONE_NUMBER_ID = "000000000000";
delete process.env.WHATSAPP_STAFF_ALERTS;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let wa: typeof import("../src/lib/whatsapp");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  wa = await import("../src/lib/whatsapp");
});
test.after(async () => {
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

test("staff dispatch + attendance alerts are muted; customer and office (OTHER) kinds are not", () => {
  for (const k of ["TEAM_DISPATCH", "ATTENDANCE_SUMMARY"]) assert.equal(wa.isMutedStaffAlert(k), true, k);
  for (const k of ["OTHER", "BOOKING_CONFIRMATION", "JOB_COMPLETED", "QUOTATION_NOTICE", "PAYMENT_REMINDER"]) assert.equal(wa.isMutedStaffAlert(k), false, k);
  process.env.WHATSAPP_STAFF_ALERTS = "on";
  assert.equal(wa.isMutedStaffAlert("TEAM_DISPATCH"), false, "WHATSAPP_STAFF_ALERTS=on switches them back on");
  delete process.env.WHATSAPP_STAFF_ALERTS;
});

test("sendWhatsApp: a team dispatch is recorded CANCELLED and never sent", async () => {
  const r = await wa.sendWhatsApp({ kind: "TEAM_DISPATCH", toNumber: "9000000011", toName: "Crew", body: "Job Dispatch" });
  assert.equal(r.sent, false);
  const row = await db.whatsAppMessage.findUnique({ where: { id: r.id } });
  assert.equal(row?.status, "CANCELLED");
  assert.equal(row?.errorMessage, wa.WHATSAPP_STAFF_ALERTS_OFF);
});

test("queue flush cancels old staff alerts and anything older than 24 h instead of sending it", async () => {
  const staff = await db.whatsAppMessage.create({ data: { kind: "ATTENDANCE_SUMMARY", toNumber: "919000000012", body: "Attendance", status: "QUEUED" } });
  const stale = await db.whatsAppMessage.create({ data: { kind: "BOOKING_CONFIRMATION", toNumber: "919000000013", body: "Old confirmation", status: "FAILED", createdAt: new Date(Date.now() - 2 * 86400000) } });
  const r = await wa.flushWhatsAppQueue({ includeFailed: true });
  assert.equal(r.ok, true);
  assert.equal(r.sent, 0);
  const after = await db.whatsAppMessage.findMany({ where: { id: { in: [staff.id, stale.id] } }, select: { id: true, status: true, errorMessage: true } });
  assert.deepEqual(after.map((m) => m.status).sort(), ["CANCELLED", "CANCELLED"]);
  assert.equal(after.find((m) => m.id === stale.id)?.errorMessage, wa.WHATSAPP_STALE_QUEUE);
});
