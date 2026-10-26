// First email for a new enquiry = a plain acknowledgement only (owner 2026-10-23). Run: npm run test:ackemail
// Throwaway SQLite DB; no email provider configured, so the message stays QUEUED in the log (nothing leaves the machine).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-ack-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["EMAIL_API_KEY", "EMAIL_ENDPOINT", "EMAIL_FROM", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let ack: typeof import("../src/server/enquiry-ack-email");
let intake: typeof import("../src/server/enquiry-intake");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ack = await import("../src/server/enquiry-ack-email");
  intake = await import("../src/server/enquiry-intake");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const waitFor = async <T>(fn: () => Promise<T | null | undefined>, ms = 3000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, 50)); } };

test("exact wording: subject and body, with no price, quotation or invoice", () => {
  assert.equal(ack.ENQUIRY_ACK_SUBJECT, "Booking Request Received - Sahara Cleaning Services");
  assert.equal(ack.ENQUIRY_ACK_BODY, "Thank you for contacting Sahara Cleaning Services! We have received your booking request. Our team will review your requirements and get in touch with you shortly to confirm your booking. For urgent queries, call/WhatsApp us at: +91 7083347130 / 8956567130.");
  assert.ok(!/₹|rs\.?\s?\d|quotation|invoice|price|http/i.test(ack.ENQUIRY_ACK_BODY));
});

test("a new enquiry with an email gets exactly one acknowledgement; it is logged QUEUED while no provider is set; a repeat is skipped", async () => {
  const lead = await db.lead.create({ data: { leadNumber: "LD-ACK-1", name: "Asha", mobile: "9876500201", email: "asha@example.com", area: "Baner", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } as never });
  const r = await ack.sendEnquiryAck(lead.id);
  assert.equal(r.status, "queued");
  assert.equal((await ack.sendEnquiryAck(lead.id)).status, "skipped", "never twice for the same lead");
  const rows = await db.emailMessage.findMany({ where: { relatedType: "Lead", relatedId: lead.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, ack.ENQUIRY_ACK_SUBJECT);
  assert.equal(rows[0].toEmail, "asha@example.com");
  assert.ok(rows[0].body.startsWith("Dear Customer,") && rows[0].body.includes(ack.ENQUIRY_ACK_BODY));
  assert.equal(rows[0].status, "QUEUED", "not fabricated as sent");
});

test("no email on the enquiry, or a malformed one: nothing is sent", async () => {
  const a = await db.lead.create({ data: { leadNumber: "LD-ACK-2", name: "B", mobile: "9876500202", area: "x", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } as never });
  const b = await db.lead.create({ data: { leadNumber: "LD-ACK-3", name: "C", mobile: "9876500203", email: "not-an-email", area: "x", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } as never });
  assert.equal((await ack.sendEnquiryAck(a.id)).status, "skipped");
  assert.equal((await ack.sendEnquiryAck(b.id)).status, "skipped");
  assert.equal(await db.emailMessage.count({ where: { relatedId: { in: [a.id, b.id] } } }), 0);
});

test("a Cognito / email enquiry creates the lead AND triggers the acknowledgement; a duplicate delivery does not send a second one", async () => {
  const entry = { name: "Meera", mobile: "9876500204", email: "meera@example.com", service: "Home deep cleaning", location: "Kharadi", message: "2 BHK", sourceLabel: "Cognito Forms" };
  const first = await intake.ingestEnquiry(entry as never, { intakeKey: "COGNITO:9:77", defaultSource: "Cognito Forms" } as never);
  assert.ok("created" in first && first.created, JSON.stringify(first));
  const lead = await db.lead.findFirst({ where: { intakeKey: "COGNITO:9:77" } });
  assert.ok(lead, "lead is in the CRM");
  const mail = await waitFor(() => db.emailMessage.findFirst({ where: { relatedType: "Lead", relatedId: lead!.id } }));
  assert.ok(mail, "acknowledgement logged");
  assert.equal(mail!.subject, ack.ENQUIRY_ACK_SUBJECT);
  const second = await intake.ingestEnquiry(entry as never, { intakeKey: "COGNITO:9:77", defaultSource: "Cognito Forms" } as never);
  assert.ok("duplicate" in second);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await db.emailMessage.count({ where: { relatedType: "Lead", relatedId: lead!.id } }), 1);
});
