// Direct Cognito Forms webhook (2026-10-22). Run: npm run test:cognitowebhook
// Parser shapes (pure) + the route against a throwaway SQLite DB (scripts/db-setup.mjs). No network; WhatsApp creds removed.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { parseCognitoEntry } from "../src/lib/cognito-entry";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-cognito-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
const SECRET = randomBytes(24).toString("hex");

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let route: typeof import("../src/app/api/webhook/cognito/route");
const post = (body: unknown, key: string | null = SECRET, raw?: string) =>
  route.POST(new NextRequest(`http://localhost/api/webhook/cognito${key === null ? "" : `?key=${key}`}`, { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(body) }));

const entry = (n: number, over: Record<string, unknown> = {}) => ({
  Form: { Id: "7", InternalName: "BookAService", Name: "Book a service" },
  Name: { First: "Asha", Last: "Patil", FirstAndLast: "Asha Patil" },
  Phone: "+91 90000 00601",
  Email: "Asha@Example.com",
  Address: { Line1: "Flat 2, Rose Society", City: "Pune", PostalCode: "411028" },
  ServiceRequired: ["Home Deep Cleaning", "Sofa Cleaning"],
  Message: "2 BHK, this Sunday please",
  Entry: { Number: n, DateSubmitted: "2026-10-22T10:00:00Z" },
  ...over,
});

test.before(async () => {
  process.env.COGNITO_WEBHOOK_SECRET = SECRET;
  db = (await import("../src/lib/db")).db;
  route = await import("../src/app/api/webhook/cognito/route");
  await db.user.create({ data: { name: "Test Admin", email: "admin@t", role: "ADMIN" as never, passwordHash: "x" } });
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

// ---- parser -------------------------------------------------------------------------------------------------------------
test("parser: typical Cognito shapes (name object, phone formats, address object, multi-choice, entry number)", () => {
  const e = parseCognitoEntry(entry(41));
  assert.equal(e.name, "Asha Patil");
  assert.equal(e.mobile, "9000000601");
  assert.equal(e.email, "asha@example.com");
  assert.equal(e.location, "Flat 2, Rose Society, Pune, 411028");
  assert.equal(e.service, "Home Deep Cleaning, Sofa Cleaning");
  assert.equal(e.message, "2 BHK, this Sunday please");
  assert.equal(e.entryRef, "7:41");
});

test("parser: plain strings, other field names, sections one level deep, and missing pieces", () => {
  const e = parseCognitoEntry({ YourName: "Rahul", MobileNumber: "9876543210", Location: "Kharadi", Subject: "Pest control", Comments: "cockroaches", Id: "abc-1" });
  assert.deepEqual([e.name, e.mobile, e.location, e.service, e.message, e.entryRef], ["Rahul", "9876543210", "Kharadi", "Pest control", "cockroaches", "form:abc-1"]);
  const nested = parseCognitoEntry({ ContactDetails: { FullName: "Meera", WhatsApp: "0091-98111-22333" }, Entry: { Number: 5 } }, "landing");
  assert.equal(nested.name, "Meera");
  assert.equal(nested.mobile, "9811122333");
  assert.equal(nested.entryRef, "landing:5");
  const none = parseCognitoEntry({ Name: "No Phone", Email: "not-an-email" });
  assert.equal(none.mobile, "");
  assert.equal(none.email, "", "invalid e-mails are dropped");
  assert.equal(none.entryRef, "");
  assert.equal(parseCognitoEntry(null).mobile, "");
  assert.equal(parseCognitoEntry({ Phone: "12345" }).mobile, "", "too few digits");
});

// ---- route ------------------------------------------------------------------------------------------------------------------
test("inert until configured; wrong or missing key is 401; bad JSON is 400", async () => {
  const keep = process.env.COGNITO_WEBHOOK_SECRET;
  process.env.COGNITO_WEBHOOK_SECRET = "short";
  try {
    const r = await post(entry(1));
    assert.equal(r.status, 404);
    assert.equal(await r.text(), "");
  } finally {
    process.env.COGNITO_WEBHOOK_SECRET = keep;
  }
  assert.equal((await post(entry(1), "wrong")).status, 401);
  assert.equal((await post(entry(1), null)).status, 401);
  assert.equal((await post(null, SECRET, "{not json")).status, 400);
  assert.equal(await db.lead.count(), 0, "nothing created by rejected requests");
});

test("a new entry creates one lead with the Cognito entry as its idempotency key, plus follow-up and staff alert", async () => {
  const r = await post(entry(101));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body.created);
  const lead = await db.lead.findFirst({ where: { mobile: "9000000601" } });
  assert.equal(lead?.intakeKey, "COGNITO:7:101");
  assert.equal(lead?.name, "Asha Patil");
  assert.equal(lead?.email, "asha@example.com");
  assert.equal(lead?.area, "Flat 2, Rose Society, Pune, 411028");
  assert.match(lead?.notes ?? "", /Via Cognito Form \(webhook\)/);
  assert.equal(await db.followUp.count({ where: { leadId: lead!.id } }), 1);
  assert.ok((await db.notification.count({ where: { kind: "NEW_INQUIRY" } })) > 0);
  assert.equal(await db.whatsAppMessage.count({ where: { toNumber: { contains: "9000000601" } } }), 0, "nothing is sent to the customer");
});

test("Cognito re-sending the same entry never creates a second lead or a second alert", async () => {
  const leads = await db.lead.count();
  const alerts = await db.notification.count();
  const r = await post(entry(101));
  assert.equal(r.status, 200);
  assert.ok((await r.json()).duplicate);
  assert.equal(await db.lead.count(), leads);
  assert.equal(await db.notification.count(), alerts);
  // A different customer (own phone AND e-mail — the same e-mail would rightly be treated as the same customer).
  const other = { Phone: "9000000602", Email: "other602@example.com" };
  const both = await Promise.all([post(entry(102, other)), post(entry(102, other))]);
  assert.deepEqual(both.map((x) => x.status), [200, 200]);
  assert.equal(await db.lead.count({ where: { mobile: "9000000602" } }), 1, "two simultaneous deliveries -> one lead");
});

test("a different entry from the same customer updates the open enquiry; its retry is also ignored", async () => {
  const r = await post(entry(103, { Message: "also need balcony" }));
  const body = await r.json();
  assert.ok(body.matchedExisting, "same mobile -> existing open lead");
  assert.equal(await db.lead.count({ where: { mobile: "9000000601" } }), 1);
  const notes = await db.timelineEntry.count({ where: { body: { contains: "[intake:COGNITO:7:103]" } } });
  assert.equal(notes, 1);
  const again = await (await post(entry(103, { Message: "also need balcony" }))).json();
  assert.ok(again.duplicate);
  assert.equal(await db.timelineEntry.count({ where: { body: { contains: "[intake:COGNITO:7:103]" } } }), 1, "no second repeat note");
});

test("an entry without a usable mobile is not dropped silently: the team is alerted, Cognito gets 200", async () => {
  const before = await db.notification.count({ where: { title: { contains: "without a mobile" } } });
  const r = await post({ Name: "Walk-in", Email: "walkin@example.com", Service: "Painting", Entry: { Number: 900 } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: false, reason: "no valid mobile number", alerted: true });
  const after = await db.notification.findMany({ where: { title: { contains: "without a mobile" } } });
  assert.ok(after.length > before);
  assert.match(after[0].body ?? "", /Walk-in/);
});
