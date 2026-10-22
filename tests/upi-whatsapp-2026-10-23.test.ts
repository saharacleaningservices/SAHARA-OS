// UPI QR intent format + WhatsApp failures always logged (owner 2026-10-23). Run: npm run test:upiwa
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { UPI_QR_OPTIONS, upiPayUri } from "../src/lib/upi";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-upiwa-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OUTBOUND_MODE"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};
let db: typeof import("../src/lib/db").db;
let wa: typeof import("../src/lib/whatsapp");
test.before(async () => { db = (await import("../src/lib/db")).db; wa = await import("../src/lib/whatsapp"); });
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("UPI intent is exactly upi://pay?pa=…@…&pn=Sahara%20Cleaning%20Services&am=<amount>&cu=INR", () => {
  assert.equal(upiPayUri({ upiId: "7083347130@okbizaxis", payeeName: "Sahara Cleaning Services", amount: 4999 }), "upi://pay?pa=7083347130@okbizaxis&pn=Sahara%20Cleaning%20Services&am=4999&cu=INR");
  assert.equal(upiPayUri({ upiId: " 7083347130@okbizaxis ", payeeName: "Sahara Cleaning Services", amount: 3333.5 }), "upi://pay?pa=7083347130@okbizaxis&pn=Sahara%20Cleaning%20Services&am=3333.50&cu=INR");
  assert.ok(!upiPayUri({ upiId: "a@b", payeeName: "X", amount: 0 }).includes("am="), "no amount when nothing is due");
  assert.ok(UPI_QR_OPTIONS.margin >= 4 && UPI_QR_OPTIONS.width >= 600, "full quiet zone, high resolution");
});

test("a template send that cannot go out (not connected) is written to the Message Log with the reason", async () => {
  process.env.WHATSAPP_OUTBOUND_MODE = "live"; // let the number through the TEST gate so the not-connected branch is reached
  const r = await wa.sendWhatsAppTemplate({ kind: "BOOKING_CONFIRMATION", toNumber: "9876500099", toName: "Asha", templateName: "sahara_booking_confirmed_v4", languageCode: "en", bodyParams: ["a"], preview: "p", relatedType: "Job", relatedId: "job-x" });
  delete process.env.WHATSAPP_OUTBOUND_MODE;
  assert.equal(r.sent, false);
  const row = await db.whatsAppMessage.findFirst({ where: { relatedId: "job-x" } });
  assert.ok(row, "logged, not silent");
  assert.equal(row!.status, "FAILED");
  assert.match(row!.errorMessage ?? "", /not connected/i);
});

test("a plain message that cannot go out (not connected) stays queued with the reason recorded", async () => {
  process.env.WHATSAPP_OUTBOUND_MODE = "live";
  const r = await wa.sendWhatsApp({ kind: "BOOKING_CONFIRMATION", toNumber: "9876500098", body: "hello", relatedType: "Job", relatedId: "job-y" });
  delete process.env.WHATSAPP_OUTBOUND_MODE;
  assert.equal(r.sent, false);
  const row = await db.whatsAppMessage.findFirst({ where: { relatedId: "job-y" } });
  assert.match(row!.errorMessage ?? "", /not connected/i);
});

test("TEST mode blocks a real customer and says so in the log", async () => {
  const r = await wa.sendWhatsApp({ kind: "BOOKING_CONFIRMATION", toNumber: "9876500097", body: "hello", relatedType: "Job", relatedId: "job-z" });
  assert.equal(r.sent, false);
  const row = await db.whatsAppMessage.findFirst({ where: { relatedId: "job-z" } });
  assert.equal(row!.status, "CANCELLED");
  assert.match(row!.errorMessage ?? "", /TEST MODE/);
});
