// Booking confirmation WhatsApp — ONE message per booking with View Quotation, Payment and Google Review
// (owner Phase 2, 2026-10-22). Run: npm run test:bookingconfirm
// Throwaway SQLite DB (scripts/db-setup.mjs). NOTHING reaches Meta: the free-text path runs in TEST mode with no
// credentials, and the template path uses a stubbed fetch and the approved QA number only.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// NOTE: modules that open the database (src/lib/whatsapp, src/server/*) are imported in before(), AFTER DATABASE_URL is set.
import { CLOUD_TEMPLATES, templateByName, GOOGLE_REVIEW_URL } from "../src/lib/whatsapp-cloud-templates";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-bookconfirm-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_BOOKING_TEMPLATE", "WHATSAPP_OUTBOUND_MODE"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let WHATSAPP_TRANSACTIONAL_TEMPLATES: readonly string[] = [];
let msgs: typeof import("../src/server/booking-messages");
const REVIEW = "https://g.page/r/TEST-review-link/review";
let n = 0;
const makeJob = (mobile: string) =>
  db.job.create({
    data: { jobNumber: `T-JOB-${++n}`, customerName: "Asha", customerMobile: mobile, address: "Flat 2", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() + 3 * 86_400_000), scheduledTime: "10:00 AM", jobValue: 4999, status: "ASSIGNED" } as never,
  });
const confirmations = (jobId: string) => db.whatsAppMessage.findMany({ where: { kind: "BOOKING_CONFIRMATION", relatedType: "Job", relatedId: jobId } });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  msgs = await import("../src/server/booking-messages");
  WHATSAPP_TRANSACTIONAL_TEMPLATES = (await import("../src/lib/whatsapp")).WHATSAPP_TRANSACTIONAL_TEMPLATES;
  await db.companySettings.upsert({ where: { id: "default" }, update: { googleReviewUrl: REVIEW }, create: { id: "default", name: "Sahara Cleaning Services", phone: "0", email: "t@t", address: "x", googleReviewUrl: REVIEW } as never });
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

// ---- template definition ---------------------------------------------------------------------------------------------------
test("v4 template: UTILITY, two URL buttons (quotation + pay), review link as a body parameter, Meta-safe body", () => {
  const t = templateByName("sahara_booking_confirmed_v4");
  assert.ok(t);
  assert.equal(t!.category, "UTILITY");
  const urls = (t!.buttons ?? []).filter((b) => b.type === "URL");
  assert.equal(urls.length, 2, "Meta allows at most 2 URL buttons");
  assert.deepEqual(urls.map((b) => b.text), ["View Quotation", "Pay Now / Later"]);
  assert.match((urls[0] as { url: string }).url, /\/booking\/quotation\/\{\{1\}\}$/);
  assert.match((urls[1] as { url: string }).url, /\/booking\/pay\/\{\{1\}\}$/);
  const vars = [...t!.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  assert.deepEqual(vars, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(t!.examples?.length, 7);
  assert.ok(!/^\s*\{\{/.test(t!.body) && !/\{\{\d+\}\}\s*$/.test(t!.body), "Meta rejects a body that starts or ends with a variable");
  assert.match(t!.body, /rate us on Google: \{\{7\}\}/);
  assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes("sahara_booking_confirmed_v4"), "may reach customers in transactional mode (utility)");
  assert.equal(new Set(CLOUD_TEMPLATES.map((x) => x.name)).size, CLOUD_TEMPLATES.length, "template names stay unique");
});

test("v4 parameters: the Settings review link, or the built-in Google link when Settings has none", () => {
  const job = { customerName: "Asha", jobNumber: "JOB-1", scheduledDate: new Date("2026-11-02T00:00:00Z"), scheduledTime: "10:00 AM", area: "Kharadi" };
  assert.equal(msgs.bookingConfirmationV4Params(job, "Home Deep Cleaning", REVIEW)[6], REVIEW);
  assert.equal(msgs.bookingConfirmationV4Params(job, "Home Deep Cleaning", null)[6], GOOGLE_REVIEW_URL);
  assert.equal(msgs.bookingConfirmationV4Params(job, "Home Deep Cleaning", "  ")[6], GOOGLE_REVIEW_URL);
});

// ---- free-text path (default, templates off) -------------------------------------------------------------------------------
test("default message carries booking, quotation, payment and review links — and TEST mode keeps it from a real customer", async () => {
  const job = await makeJob("9000000701");
  await msgs.sendBookingConfirmation(job.id);
  const [m, ...rest] = await confirmations(job.id);
  assert.equal(rest.length, 0, "exactly one confirmation");
  const token = (await db.job.findUnique({ where: { id: job.id } }))!.publicToken!;
  assert.ok(token && token.length >= 20, "an unguessable booking token was created");
  // Short links (owner 2026-10-24): /b/<code> booking, /q/<code> quotation PDF, /p/<code> pay advance — never the long token.
  const code = (await db.job.findUniqueOrThrow({ where: { id: job.id }, select: { shortCode: true } })).shortCode!;
  assert.match(code, /^[A-Za-z0-9]{10}$/);
  assert.ok(m.body.includes(`/b/${code}`), "booking link");
  assert.ok(m.body.includes(`/q/${code}`), "quotation link");
  assert.ok(m.body.includes(`/p/${code}`), "payment link");
  assert.ok(!m.body.includes(token), "the long booking token is not in the message");
  assert.ok(m.body.includes(REVIEW), "Google review link");
  assert.notEqual(m.status, "SENT", "TEST mode: a real customer number is never messaged");
});

test("one confirmation per booking: a repeat call is skipped and simultaneous calls send once", async () => {
  const job = await makeJob("9000000702");
  await msgs.sendBookingConfirmation(job.id);
  assert.deepEqual(await msgs.sendBookingConfirmation(job.id), { skipped: "already-confirmed" });
  assert.equal((await confirmations(job.id)).length, 1);
  const job2 = await makeJob("9000000703");
  await Promise.all([msgs.sendBookingConfirmation(job2.id), msgs.sendBookingConfirmation(job2.id), msgs.sendBookingConfirmation(job2.id)]);
  assert.equal((await confirmations(job2.id)).length, 1, "three simultaneous confirmations -> one message");
});

// ---- template path (v4), network stubbed, QA number only -------------------------------------------------------------------
test("v4: one template message with quotation + pay buttons and the review link; nothing else is called", async () => {
  const keep = { ...process.env };
  const realFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  Object.assign(process.env, { WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_BOOKING_TEMPLATE: "v4", WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000" });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const job = await makeJob("9800817070"); // the approved QA number (TEST mode allows only this one)
    await msgs.sendBookingConfirmation(job.id);
    await msgs.sendBookingConfirmation(job.id); // duplicate guard holds on the template path too
    const sends = calls.filter((c) => /\/messages$/.test(c.url));
    assert.equal(sends.length, 1, "exactly one send");
    const tpl = sends[0].body.template as { name: string; components: { type: string; sub_type?: string; index?: string; parameters: { text: string }[] }[] };
    assert.equal(tpl.name, "sahara_booking_confirmed_v4");
    const bodyParams = tpl.components.find((c) => c.type === "body")!.parameters.map((p) => p.text);
    assert.equal(bodyParams.length, 7);
    assert.equal(bodyParams[6], REVIEW, "review link from Settings");
    const token = (await db.job.findUnique({ where: { id: job.id } }))!.publicToken!;
    const buttons = tpl.components.filter((c) => c.type === "button");
    assert.deepEqual(buttons.map((b) => [b.sub_type, String(b.index), b.parameters[0].text]), [["url", "0", token], ["url", "1", token]]);
    const rows = await confirmations(job.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].templateName, "sahara_booking_confirmed_v4");
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

// ---- v5 / payment_received_v1 / job_completed_v1 (owner 2026-10-22: strictly UTILITY, real domain) ---------------------------
test("v5, payment_received_v1 and job_completed_v1: UTILITY, real booking domain, no urgency/socials, Meta-safe", () => {
  for (const name of ["sahara_booking_confirmed_v5", "sahara_payment_received_v1", "sahara_job_completed_v1", "sahara_service_started_v1"]) {
    const t = templateByName(name);
    assert.ok(t, name);
    assert.equal(t!.category, "UTILITY", name);
    assert.ok(!/\{\{\d+\}\}\s*$/.test(t!.body) && !/^\s*\{\{/.test(t!.body), `${name}: body must not start/end with a variable`);
    const vars = [...t!.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.equal(t!.examples?.length, vars.length, `${name}: one example per variable`);
    assert.ok(!/sahara\.co\.in|limited|released/i.test(t!.body), `${name}: no urgency or foreign domain`);
    if (name !== "sahara_booking_confirmed_v5") assert.ok(!/instagram|youtube/i.test(t!.body), `${name}: no social links`);
    const urls = (t!.buttons ?? []).filter((b) => b.type === "URL") as { url: string }[];
    assert.ok(urls.length <= 2, `${name}: max 2 URL buttons`);
    for (const u of urls) assert.ok(u.url.startsWith("https://") && !u.url.includes("sahara.co.in"), u.url);
    assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes(name), `${name}: transactional allowlist`);
  }
  const v5 = templateByName("sahara_booking_confirmed_v5")!;
  assert.equal(v5.header?.type, "IMAGE");
  assert.deepEqual((v5.buttons ?? []).map((b) => b.text), ["View Quotation", "Pay Now / Later"]);
  assert.match(v5.body, /7083347130 \/ 8956567130/);
  // Owner 2026-10-23: cleaning video + Instagram + Facebook (the verified profiles), no review link, no ladder / water notes.
  assert.ok(v5.body.includes("https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA"), "cleaning video link");
  assert.ok(v5.body.includes("https://www.instagram.com/saharacleaningservices.pune/") && v5.body.includes("https://www.facebook.com/saharacleaningservices"));
  assert.ok(!/g\.page|review|ladder|water|electricity/i.test(v5.body), "no review link, no ladder / water notes");
  assert.deepEqual([...v5.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6], "same six parameters");
  const pay = templateByName("sahara_payment_received_v1")!;
  assert.match((pay.buttons![0] as { url: string }).url, /\/booking\/receipt\/\{\{1\}\}$/);
  assert.deepEqual(pay.buttons![1], { type: "PHONE_NUMBER", text: "Call Helpline", phone: "+917083347130" });
  const done = templateByName("sahara_job_completed_v1")!;
  assert.match((done.buttons![0] as { url: string }).url, /\/booking\/pay\/\{\{1\}\}$/);
});

test("v5 send: image header + 6 body params + both token buttons, one message, no review link", async () => {
  const keep = { ...process.env };
  const realFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  Object.assign(process.env, { WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_BOOKING_TEMPLATE: "v5", WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000" });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST5" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const job = await makeJob("9800817070");
    await msgs.sendBookingConfirmation(job.id);
    const sends = calls.filter((c) => /\/messages$/.test(c.url));
    assert.equal(sends.length, 1);
    const tpl = sends[0].body.template as { name: string; components: { type: string; parameters: { text?: string; image?: { link: string } }[] }[] };
    assert.equal(tpl.name, "sahara_booking_confirmed_v5");
    assert.match(tpl.components.find((c) => c.type === "header")!.parameters[0].image!.link, /\/marketing\/booking-header\.jpg$/);
    assert.equal(tpl.components.find((c) => c.type === "body")!.parameters.length, 6);
    assert.equal(tpl.components.filter((c) => c.type === "button").length, 2);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

// ---- crew dispatch card: customer phone and amounts never included ---------------------------------------------------------------
test("crew job card hides the customer phone and any amount", async () => {
  const { teamDispatchMessage } = await import("../src/lib/whatsapp-templates");
  const body = teamDispatchMessage({
    customerName: "Asha", mobile: "9876543210", area: "Kharadi", address: "Flat 2", mapLink: "https://maps.google.com/?q=1",
    service: "Home Deep Cleaning", flatType: "2 BHK", date: new Date("2026-11-02T00:00:00Z"), timeSlot: "10:00 AM", team: 2,
    supervisor: "Ravi", vehicle: "Tempo (MH12)", materials: ["Vacuum x1"], notes: "Use side gate", cardLink: "https://crm.example.test/crew-card/tok123",
  });
  assert.ok(!body.includes("9876543210") && !/987654|43210/.test(body), "no phone");
  assert.ok(!/₹|Rs\.?\s?\d|\bINR\b|Amount|Price|Balance|Advance/i.test(body), "no amounts");
  // Owner 2026-10-26: compact card — location is plain text and the job-card token URL is the ONLY link (no Google Maps preview box).
  assert.ok(body.includes("📍 Kharadi, Flat 2"), "plain-text location");
  assert.deepEqual(body.match(/https?:\/\/\S+/g), ["https://crm.example.test/crew-card/tok123"], "exactly one link: the job card");
  assert.ok(!/maps\.google|google\.com/.test(body), "no Google Maps URL in the message");
});
