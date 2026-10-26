// Admin "Submit to Meta" (2026-10-22): payload shape, Super-Admin-only, allow-list, protected-WABA refusal, no duplicates.
// Run: npm run test:metasubmit — the Meta API is a stubbed fetch; nothing leaves the machine and no real credential is used.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Production serves customer links from the booking domain; the templates read BOOKING_URL when the module loads.
process.env.BOOKING_URL = "https://booking.saharacleaningservices.com";
let templateByName: typeof import("../src/lib/whatsapp-cloud-templates").templateByName;
let buildMetaTemplatePayload: typeof import("../src/lib/meta-template-payload").buildMetaTemplatePayload;
let foreignUrlButtons: typeof import("../src/lib/meta-template-payload").foreignUrlButtons;
let PROTECTED_WABA_ID = "";
const dir = mkdtempSync(path.join(tmpdir(), "sahara-metasubmit-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};

let act: typeof import("../src/server/actions/meta-templates");
let db: typeof import("../src/lib/db").db;
const ADMIN: Session = { sub: "a", name: "A", email: "a@t", role: "ADMIN" };
const realFetch = globalThis.fetch;
const calls: { url: string; method: string; body?: Record<string, unknown> }[] = [];
let existingNames: string[] = [];
const FAKE = { WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000", WHATSAPP_BUSINESS_ACCOUNT_ID: "999000111222333" };
const stub = () => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === "GET") return new Response(JSON.stringify({ data: existingNames.map((name) => ({ name, status: "PENDING", category: "UTILITY" })) }), { status: 200 });
    return new Response(JSON.stringify({ id: "1", status: "PENDING", category: "UTILITY" }), { status: 200 });
  }) as typeof fetch;
};

test.before(async () => {
  ({ templateByName } = await import("../src/lib/whatsapp-cloud-templates"));
  ({ buildMetaTemplatePayload, foreignUrlButtons, PROTECTED_WABA_ID } = await import("../src/lib/meta-template-payload"));
  db = (await import("../src/lib/db")).db; act = await import("../src/server/actions/meta-templates");
});
test.after(async () => { M._load = realLoad; globalThis.fetch = realFetch; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });
test.beforeEach(() => { calls.length = 0; existingNames = []; Object.assign(process.env, FAKE); delete process.env.WHATSAPP_APP_ID; delete process.env.META_APP_ID; stub(); session = ADMIN; });

test("payload: UTILITY components built from the repo definition", () => {
  const pay = buildMetaTemplatePayload(templateByName("sahara_payment_received_v1")!);
  assert.equal(pay.category, "UTILITY");
  const [h, b, btn] = pay.components as Record<string, unknown>[];
  assert.equal(h.format, "IMAGE");
  assert.deepEqual((b.example as { body_text: string[][] }).body_text[0], ["Priya", "1,000", "JOB-2026-0150", "UPI", "2,999"]);
  const buttons = (btn as { buttons: Record<string, unknown>[] }).buttons;
  assert.equal(buttons[0].url, "https://booking.saharacleaningservices.com/booking/receipt/{{1}}");
  assert.deepEqual(buttons[1], { type: "PHONE_NUMBER", text: "Call Helpline", phone_number: "+917083347130" });
  const done = buildMetaTemplatePayload(templateByName("sahara_job_completed_v1")!);
  assert.ok(!done.components.some((c) => (c as { type: string }).type === "HEADER"));
});

test("only the Super Admin can submit; every other role and no session is refused without any Meta call", async () => {
  for (const role of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) {
    session = { ...ADMIN, role };
    assert.equal((await act.submitTemplateToMeta("sahara_payment_received_v1")).success, false, role);
  }
  session = null;
  assert.equal((await act.submitTemplateToMeta("sahara_payment_received_v1")).success, false);
  assert.equal(calls.length, 0);
});

test("allow-list: any other template name is refused", async () => {
  const r = await act.submitTemplateToMeta("sahara_diwali_festival_offer");
  assert.equal(r.success, false);
  assert.equal(calls.length, 0);
});

test("the protected WhatsApp Business Account is never contacted", async () => {
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = PROTECTED_WABA_ID;
  const r = await act.submitTemplateToMeta("sahara_payment_received_v1");
  assert.equal(r.success, false);
  assert.equal((await act.getTemplateSubmissionStatus()).success, false);
  assert.equal(calls.length, 0);
});

test("submit: checks for an existing template, then posts exactly one create call", async () => {
  const r = await act.submitTemplateToMeta("sahara_payment_received_v1");
  assert.equal(r.success, true);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "POST"]);
  assert.ok(calls[1].url.endsWith("/999000111222333/message_templates"));
  assert.equal((calls[1].body as { name: string }).name, "sahara_payment_received_v1");
});

test("a template that already exists on Meta is reported and never resubmitted", async () => {
  existingNames = ["sahara_payment_received_v1"];
  const r = await act.submitTemplateToMeta("sahara_payment_received_v1");
  assert.equal(r.success, false);
  assert.match((r as { error: string }).error, /already exists/);
  assert.deepEqual(calls.map((c) => c.method), ["GET"]);
});

test("links on the CRM (app.) domain are caught before anything is sent to Meta", () => {
  const t = templateByName("sahara_payment_received_v1")!;
  assert.deepEqual(foreignUrlButtons(t), [], "the real templates are on the booking domain");
  const bad = { ...t, buttons: [{ type: "URL" as const, text: "View Receipt", url: "https://app.saharacleaningservices.com/booking/receipt/{{1}}" }] };
  assert.equal(foreignUrlButtons(bad).length, 1);
});
