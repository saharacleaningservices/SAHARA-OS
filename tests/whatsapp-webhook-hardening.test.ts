// WhatsApp webhook: menu taps → CRM, duplicate-message detection, and DB-error → HTTP 500 / Meta-retry behaviour.
// Fresh throwaway SQLite DB; no network (auto-replies are off, credentials cleared), so only CRM writes are asserted.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-wa-hardening-"));
const dbFile = path.join(dir, "test.db");
const APP_SECRET = "unit-test-app-secret-not-real";
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.WHATSAPP_OUTBOUND_MODE = "test";
process.env.WHATSAPP_APP_SECRET = APP_SECRET;
delete process.env.WHATSAPP_AUTO_REPLIES;
delete process.env.WHATSAPP_AI_ENABLED;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
test.before(async () => {
  db = (await import("../src/lib/db")).db;
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

// Simulates a database failure on lead inserts (e.g. SQLITE_BUSY). Returns a restore function.
function breakLeadCreate(message: string) {
  const delegate = db.lead as unknown as { create: (...a: unknown[]) => unknown };
  const original = delegate.create;
  delegate.create = async () => { throw new Error(message); };
  return () => { delegate.create = original; };
}

async function post(body: unknown) {
  const { POST } = await import("../src/app/api/webhooks/whatsapp/route");
  const { NextRequest } = await import("next/server");
  const raw = JSON.stringify(body);
  const sig = "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return POST(new NextRequest("http://localhost/api/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body: raw }));
}
const envelope = (message: Record<string, unknown>) => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: message.from, profile: { name: "Priya Sharma" } }], messages: [{ timestamp: String(Math.floor(Date.now() / 1000)), ...message }] } }] }],
});
const listTap = (from: string, id: string, rowId: string, title: string) =>
  envelope({ from, id, type: "interactive", interactive: { type: "list_reply", list_reply: { id: rowId, title } } });
const text = (from: string, id: string, body: string) => envelope({ from, id, type: "text", text: { body } });
const leadsFor = (mobile: string) => db.lead.findMany({ where: { mobile } });

test("menu tap from a new number creates ONE lead tagged with the chosen service, a timeline note, and links the inbound row", async () => {
  const res = await post(listTap("919811100001", "wamid.TAP1", "bot_pest", "Pest Control"));
  assert.equal(res.status, 200);
  const leads = await leadsFor("9811100001");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].service, "PEST_CONTROL");
  assert.equal(leads[0].source, "WHATSAPP");
  assert.equal(leads[0].stage, "NEW");
  const notes = await db.timelineEntry.findMany({ where: { leadId: leads[0].id } });
  assert.ok(notes.some((n) => /Menu selection: Pest Control/.test(n.body ?? "")), "choice is on the timeline");
  const inbound = await db.whatsAppMessage.findMany({ where: { providerMessageId: "wamid.TAP1", direction: "INBOUND" } });
  assert.equal(inbound.length, 1);
  assert.equal(inbound[0].relatedId, leads[0].id);
});

test("a later tap on a still-NEW lead re-tags the service and does not create a second lead; status/slots rows leave it alone", async () => {
  assert.equal((await post(listTap("919811100001", "wamid.TAP2", "bot_painting", "Painting & Waterproofing"))).status, 200);
  let leads = await leadsFor("9811100001");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].service, "INTERIOR_PAINTING");
  assert.equal((await post(listTap("919811100001", "wamid.TAP3", "bot_status", "Booking / Crew Status"))).status, 200);
  leads = await leadsFor("9811100001");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].service, "INTERIOR_PAINTING", "bot_status does not change the service");
});

test("a lead that is no longer NEW is never re-tagged by a menu tap (only a note is added)", async () => {
  await db.lead.create({ data: { leadNumber: "LD-T-ADV", name: "Advanced Lead", mobile: "9811100002", whatsapp: "9811100002", area: "x", service: "COMMERCIAL_CLEANING" as never, source: "WEBSITE" as never, stage: "QUOTATION" } });
  assert.equal((await post(listTap("919811100002", "wamid.TAP4", "bot_pest", "Pest Control"))).status, 200);
  const leads = await leadsFor("9811100002");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].service, "COMMERCIAL_CLEANING");
  const notes = await db.timelineEntry.findMany({ where: { leadId: leads[0].id } });
  assert.ok(notes.some((n) => /Menu selection/.test(n.body ?? "")));
});

test("the same Meta message id delivered twice is processed once (one inbound row, one lead, one note)", async () => {
  const payload = listTap("919811100003", "wamid.DUP1", "bot_home", "Deep Cleaning & Offers");
  assert.equal((await post(payload)).status, 200);
  assert.equal((await post(payload)).status, 200);
  assert.equal((await db.whatsAppMessage.count({ where: { providerMessageId: "wamid.DUP1", direction: "INBOUND" } })), 1);
  const leads = await leadsFor("9811100003");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].service, "HOME_DEEP_CLEANING");
  const notes = await db.timelineEntry.findMany({ where: { leadId: leads[0].id, body: { contains: "Menu selection" } } });
  assert.equal(notes.length, 1);
});

test("a database error returns HTTP 500 and leaves no inbound row, so Meta's redelivery is processed (not skipped as a duplicate)", async () => {
  const payload = text("919811100004", "wamid.ERR1", "Need a quote for 3BHK flat cleaning next week");
  const restore = breakLeadCreate("SQLITE_BUSY: database is locked");
  const failed = await post(payload);
  assert.equal(failed.status, 500, "real failure → Meta retries");
  assert.equal(await db.whatsAppMessage.count({ where: { providerMessageId: "wamid.ERR1" } }), 0, "dedupe row removed");
  assert.equal((await leadsFor("9811100004")).length, 0);
  restore();
  const retried = await post(payload); // Meta's redelivery
  assert.equal(retried.status, 200);
  assert.equal((await leadsFor("9811100004")).length, 1, "the redelivered message is processed");
  assert.equal(await db.whatsAppMessage.count({ where: { providerMessageId: "wamid.ERR1", direction: "INBOUND" } }), 1);
});

test("a poison message is given up on after 3 failures (200 + team alert) so Meta never disables the webhook", async () => {
  await db.user.create({ data: { name: "Test Admin", email: "admin@t.test", passwordHash: "x", role: "ADMIN" } }); // notifications fan out to users
  const payload = text("919811100005", "wamid.POISON", "Need a quote for office cleaning in Kharadi");
  const restore = breakLeadCreate("boom");
  assert.equal((await post(payload)).status, 500);
  assert.equal((await post(payload)).status, 500);
  assert.equal((await post(payload)).status, 200, "third failure: dropped");
  restore();
  const alert = await db.notification.findFirst({ where: { title: { contains: "could not be processed" } } });
  assert.ok(alert, "team is alerted to reply manually");
});

test("unsigned or wrongly signed requests are rejected with 401 and write nothing", async () => {
  const { POST } = await import("../src/app/api/webhooks/whatsapp/route");
  const { NextRequest } = await import("next/server");
  const raw = JSON.stringify(listTap("919811100006", "wamid.BAD", "bot_home", "x"));
  const res = await POST(new NextRequest("http://localhost/api/webhooks/whatsapp", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body: raw }));
  assert.equal(res.status, 401);
  assert.equal((await leadsFor("9811100006")).length, 0);
});

test("malformed JSON is acknowledged with 200 (a retry cannot fix it)", async () => {
  const { POST } = await import("../src/app/api/webhooks/whatsapp/route");
  const { NextRequest } = await import("next/server");
  const raw = "{not json";
  const sig = "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const res = await POST(new NextRequest("http://localhost/api/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": sig }, body: raw }));
  assert.equal(res.status, 200);
});
