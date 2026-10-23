// Template -> plain-text fallback (final polish run): a template send that definitely did not go out is repeated as text; a TIMEOUT never is
// (it may have been delivered), and a failed attempt never blocks the next one. Run: npx tsx --test tests/whatsapp-fallback.test.ts
// Synthetic data; throwaway DB; the Meta API is a stub (no network).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-fb-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let handlers: typeof import("../src/server/job-queue-handlers");
let booking: typeof import("../src/server/booking-messages");
let wa: typeof import("../src/lib/whatsapp");
const realFetch = globalThis.fetch;
const keep = { ...process.env };
type Call = { type: string; template?: string; body?: string };
let calls: Call[] = [];
type Step = "ok" | "reject" | "timeout";
let script: Step[] = [];

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  handlers = await import("../src/server/job-queue-handlers");
  booking = await import("../src/server/booking-messages");
  wa = await import("../src/lib/whatsapp");
  Object.assign(process.env, { WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000", WHATSAPP_OUTBOUND_MODE: "live", WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_COMPLETED_TEMPLATE: "v2", WHATSAPP_STARTED_TEMPLATE: "v1", WHATSAPP_BOOKING_TEMPLATE: "v5" });
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ type: b.type, template: b.template?.name, body: b.text?.body });
    const step = script.shift() ?? "ok";
    if (step === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (step === "reject") return new Response(JSON.stringify({ error: { code: 132001, message: "Template name does not exist in the translation" } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
  }) as typeof fetch;
});
test.after(async () => {
  globalThis.fetch = realFetch;
  M._load = realLoad;
  for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
  Object.assign(process.env, keep);
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

let n = 0;
const mkJob = (status: string) => db.job.create({ data: { jobNumber: `FB-${++n}`, customerName: "Asha", customerMobile: "9811111111", address: "Flat 2, Baner", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() + 86400000), scheduledTime: "10:00 AM", jobValue: 5000, status } as never });
const reset = (...s: Step[]) => { calls = []; script = s; };
const rows = (kind: string, id: string) => db.whatsAppMessage.findMany({ where: { kind, relatedId: id }, orderBy: { createdAt: "asc" } });

test("rule: fall back only when delivery definitely did not happen", () => {
  assert.equal(wa.shouldFallBackToText("Template name does not exist in the translation"), true);
  assert.equal(wa.shouldFallBackToText("HTTP 500"), true);
  assert.equal(wa.shouldFallBackToText("Could not reach WhatsApp"), true);
  assert.equal(wa.shouldFallBackToText("Timed out talking to WhatsApp — it may still be delivered; not retried to avoid a duplicate"), false);
  for (const refusal of [wa.WHATSAPP_TEST_MODE_BLOCK, wa.WHATSAPP_NOT_CONNECTED, wa.WHATSAPP_OPT_OUT_ERROR]) assert.equal(wa.shouldFallBackToText(refusal), false);
  assert.equal(wa.shouldFallBackToText(undefined), false);
});

test("Work Completed: template rejected -> the same invoice + review links go out as plain text, once; a later call sends nothing more", async () => {
  const job = await mkJob("COMPLETED");
  await db.invoice.create({ data: { invoiceNumber: `INV-FB-${job.id.slice(-5)}`, jobId: job.id, customerName: "Asha", lineItems: "[]", subTotal: 5000, totalAmount: 5000 } as never });
  reset("reject", "ok");
  await handlers.sendJobCompletedNotice(job.id);
  assert.deepEqual(calls.map((c) => c.type), ["template", "text"]);
  assert.equal(calls[0].template, "sahara_job_completed_v2");
  assert.match(calls[1].body ?? "", /\/i\/[A-Za-z0-9]{10}/);
  assert.ok(!(calls[1].body ?? "").includes("/booking/pay/"));
  assert.deepEqual((await rows("JOB_COMPLETED", job.id)).map((r) => r.status), ["FAILED", "SENT"]);
  reset();
  await handlers.sendJobCompletedNotice(job.id);
  assert.equal(calls.length, 0, "already delivered: nothing more");
});

test("Work Completed: a TIMEOUT is not repeated as text (could be a duplicate) and does not make the queue retry", async () => {
  const job = await mkJob("COMPLETED");
  reset("timeout");
  await handlers.sendJobCompletedNotice(job.id); // must not throw
  assert.deepEqual(calls.map((c) => c.type), ["template"]);
  assert.equal((await rows("JOB_COMPLETED", job.id)).length, 1);
});

test("Work Completed: template AND text both fail -> the error reaches the queue (it retries), and the failed rows do not block the retry", async () => {
  const job = await mkJob("COMPLETED");
  reset("reject", "reject");
  await assert.rejects(() => handlers.sendJobCompletedNotice(job.id), /Template name does not exist|HTTP|outside|window|message/i);
  reset("ok");
  await handlers.sendJobCompletedNotice(job.id); // the queue's retry
  assert.deepEqual(calls.map((c) => c.template ?? c.type), ["sahara_job_completed_v2"]);
  assert.ok((await rows("JOB_COMPLETED", job.id)).some((r) => r.status === "SENT"));
});

test("Booking confirmation (v5): template rejected -> the standard text confirmation is sent; timeout -> no second message", async () => {
  const a = await mkJob("ASSIGNED");
  reset("reject", "ok");
  await booking.sendBookingConfirmation(a.id);
  assert.deepEqual(calls.map((c) => c.type), ["template", "text"]);
  assert.equal(calls[0].template, "sahara_booking_confirmed_v5");
  assert.ok((calls[1].body ?? "").includes(a.jobNumber));
  assert.deepEqual((await rows("BOOKING_CONFIRMATION", a.id)).map((r) => r.status), ["FAILED", "SENT"]);

  const b = await mkJob("ASSIGNED");
  reset("timeout");
  await booking.sendBookingConfirmation(b.id);
  assert.deepEqual(calls.map((c) => c.type), ["template"]);
  assert.equal((await rows("BOOKING_CONFIRMATION", b.id)).length, 1);

  const c = await mkJob("ASSIGNED");
  reset("ok");
  await booking.sendBookingConfirmation(c.id);
  assert.deepEqual(calls.map((x) => x.type), ["template"], "a healthy template send is untouched");
});

test("Work Started: template rejected -> plain-text notice", async () => {
  const job = await mkJob("STARTED");
  reset("reject", "ok");
  await handlers.sendServiceStartedNotice(job.id);
  assert.deepEqual(calls.map((c) => c.type), ["template", "text"]);
  assert.match(calls[1].body ?? "", /started your Home Deep Cleaning service/);
});
