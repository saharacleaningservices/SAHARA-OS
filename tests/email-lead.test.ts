// Cognito / e-mail enquiry intake (POST /api/webhook/email-lead). Run: npm run test:cognito
// Fresh throwaway SQLite DB (scripts/db-setup.mjs). No network: WhatsApp credentials cleared, TEST mode on.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-email-lead-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.EMAIL_LEAD_TOKEN = "unit-test-lead-token-not-real";
process.env.WHATSAPP_OUTBOUND_MODE = "test";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_APP_SECRET", "CRON_TOKEN"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let route: typeof import("../src/app/api/webhook/email-lead/route");
let NextRequest: typeof import("next/server").NextRequest;
const AUTH = `Bearer ${process.env.EMAIL_LEAD_TOKEN}`;

const post = (body: unknown, auth: string | null = AUTH) =>
  route.POST(
    new NextRequest("http://localhost/api/webhook/email-lead", {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  route = await import("../src/app/api/webhook/email-lead/route");
  NextRequest = (await import("next/server")).NextRequest;
  await db.user.create({ data: { name: "Altaf Shaikh", email: "altaf@t", role: "ADMIN" as never, passwordHash: "x" } });
  await db.user.create({ data: { name: "Shoyab Kazi", email: "shoyab@t", role: "ACCOUNTS" as never, passwordHash: "x", phone: "9000000009" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("fails closed: missing or wrong token is 401 and nothing is created", async () => {
  assert.equal((await post({ mobile: "9820011111" }, null)).status, 401);
  assert.equal((await post({ mobile: "9820011111" }, "Bearer wrong")).status, 401);
  assert.equal(await db.lead.count(), 0);
});

test("invalid input: bad JSON and missing/short numbers are 400", async () => {
  assert.equal((await post("not json")).status, 400);
  assert.equal((await post({ name: "No Number" })).status, 400);
  assert.equal((await post({ mobile: "12345" })).status, 400);
  assert.equal(await db.lead.count(), 0);
});

test("a valid Cognito-style enquiry creates exactly one NEW lead, normalises +91 numbers, records source/service, follow-up and alerts", async () => {
  const r = await post({ name: "Test Person", mobile: "+91 98200 22222", service: "Deep cleaning of 1 bhk flat", email: "t@example.com", message: "Need Sunday", source: "Cognito Form" });
  assert.equal(r.status, 200);
  assert.ok(((await r.json()) as { created?: string }).created);
  const lead = (await db.lead.findFirst({ where: { mobile: "9820022222" } }))!;
  assert.equal(lead.stage, "NEW");
  assert.equal(lead.source, "WEBSITE");
  assert.equal(lead.service, "HOME_DEEP_CLEANING");
  assert.match(lead.notes ?? "", /Via Cognito Form/);
  assert.equal(await db.followUp.count({ where: { leadId: lead.id } }), 1);
  assert.ok((await db.notification.count({ where: { kind: "NEW_INQUIRY" } })) >= 1, "the team is alerted in-app");
});

test("duplicates: re-sending the same enquiry never creates a second lead", async () => {
  const before = await db.lead.count();
  for (const mobile of ["9820022222", "+919820022222", "09820022222"]) {
    const r = await post({ name: "Test Person", mobile, service: "Deep cleaning", source: "Cognito Form" });
    assert.equal(r.status, 200);
    assert.ok(((await r.json()) as { matchedExisting?: string }).matchedExisting);
  }
  assert.equal(await db.lead.count(), before);
});

test("a repeat enquiry on an open lead is not silent: it is logged on the lead AND the team is alerted", async () => {
  const lead = (await db.lead.findFirst({ where: { mobile: "9820022222" } }))!;
  const notesBefore = await db.timelineEntry.count({ where: { leadId: lead.id } });
  const alertsBefore = await db.notification.count({ where: { kind: "NEW_INQUIRY", body: { contains: "Repeat" } } });
  await post({ name: "Test Person", mobile: "9820022222", service: "Sofa cleaning", message: "second message", source: "Cognito Form" });
  assert.equal(await db.timelineEntry.count({ where: { leadId: lead.id } }), notesBefore + 1);
  assert.ok((await db.notification.count({ where: { kind: "NEW_INQUIRY", body: { contains: "Repeat" } } })) > alertsBefore, "repeat enquiry notifies the team");
});

test("service detection and missing-name fallback", async () => {
  await post({ mobile: "9820033333", service: "Termite and pest control" });
  const l = (await db.lead.findFirst({ where: { mobile: "9820033333" } }))!;
  assert.equal(l.service, "PEST_CONTROL");
  assert.match(l.name, /Enquiry 9820033333/);
});

test("a COMPLETED lead older than 24 h does not swallow a new enquiry: a fresh NEW lead is created", async () => {
  await db.lead.create({ data: { leadNumber: "LD-T-OLD", name: "Old Customer", mobile: "9820044444", whatsapp: "9820044444", area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, stage: "COMPLETED" as never, createdAt: new Date(Date.now() - 3 * 86400000) } });
  const r = await post({ name: "Old Customer", mobile: "9820044444", service: "Deep cleaning again", source: "Cognito Form" });
  assert.equal(r.status, 200);
  assert.ok(((await r.json()) as { created?: string }).created, "a new lead is created for a returning customer");
  assert.equal(await db.lead.count({ where: { mobile: "9820044444", deletedAt: null } }), 2);
});

test("a trashed (soft-deleted) lead is ignored by the duplicate check", async () => {
  await db.lead.create({ data: { leadNumber: "LD-T-DEL", name: "Gone", mobile: "9820055555", whatsapp: "9820055555", area: "x", service: "HOME_DEEP_CLEANING" as never, source: "WEBSITE" as never, stage: "NEW" as never, deletedAt: new Date() } });
  const r = await post({ name: "Gone", mobile: "9820055555", service: "Home cleaning" });
  assert.ok(((await r.json()) as { created?: string }).created);
});

test("field limits and aliases: 'phone' works as the number, long text is truncated, no raw HTML/markup breaks the insert", async () => {
  const r = await post({ phone: "98200-66666", name: "N".repeat(500), message: "M".repeat(5000) + "<script>x</script>", service: "S".repeat(900) });
  assert.equal(r.status, 200);
  const l = (await db.lead.findFirst({ where: { mobile: "9820066666" } }))!;
  assert.ok(l.name.length <= 120);
  assert.ok((l.notes ?? "").length < 2000, "message capped at 1000 chars, service at 200");
});
