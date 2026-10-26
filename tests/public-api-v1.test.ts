// Contract tests for the public REST API v1 (docs/website/public-api-v1.openapi.yaml). Run: npm run test:publicapi
// Calls the route handlers directly with real NextRequest objects against a throwaway SQLite DB (scripts/db-setup.mjs).
// Safe: no WhatsApp / Sheet credentials in the process, fake mobiles (90000000xx), test-only secrets generated per run.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { MIN_SECRET_LENGTH, SIGNATURE_MAX_AGE_SECONDS, publicApiConfigured, signPublicApiRequest, verifyPublicApiRequest } from "../src/lib/public-api-auth";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-pubapi-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
// These catalogue tests exercise the festival-pricing mode, which is off on the public site by default since 2026-10-25.
process.env.PUBLIC_FESTIVAL_OFFERS = "on";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_OUTBOUND_MODE", "LEADS_SHEET_WEBHOOK_URL", "LEADS_SHEET_WEBHOOK_SECRET"]) delete process.env[k];
const TOKEN = randomBytes(24).toString("hex");
const SECRET = randomBytes(24).toString("hex");
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

// next/cache is request-only; stub it (the shared booking logic revalidates the CRM lists).
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  return realLoad.call(this, request, parent, isMain);
};

type Db = typeof import("../src/lib/db").db;
let db: Db;
let leads: typeof import("../src/app/api/public/v1/leads/route");
let catalogue: typeof import("../src/app/api/public/v1/catalogue/route");
let slots: typeof import("../src/app/api/public/v1/slots/route");
let pricing: typeof import("../src/lib/pricing-master");
let publicPricing: typeof import("../src/server/pricing");
let resetIdem: () => void;

const BASE = "http://localhost/api/public/v1";
let n = 0;
const mobile = () => `90000000${String(10 + n++).padStart(2, "0")}`;
let ipN = 0;
const visitorIp = () => `203.0.113.${(ipN++ % 250) + 1}`;
const ymdPlus = (days: number) => new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);

type SignOpts = { token?: string | null; ts?: string; sig?: string; idem?: string | null; rawBody?: string };
/** A correctly signed request unless overridden. */
function req(method: "GET" | "POST", pathAndQuery: string, body?: unknown, o: SignOpts = {}) {
  const raw = o.rawBody ?? (body === undefined ? "" : JSON.stringify(body));
  const ts = o.ts ?? String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { "x-sahara-timestamp": ts, "x-sahara-signature": o.sig ?? signPublicApiRequest(SECRET, ts, raw) };
  if (o.token !== null) headers.authorization = `Bearer ${o.token ?? TOKEN}`;
  if (method === "POST") {
    headers["content-type"] = "application/json";
    if (o.idem !== null) headers["idempotency-key"] = o.idem ?? `test-${randomBytes(8).toString("hex")}`;
  }
  return new NextRequest(`${BASE}${pathAndQuery}`, { method, headers, body: method === "POST" ? raw : undefined });
}
const lead = (over: Record<string, unknown> = {}) => ({ name: "Test Customer", mobile: mobile(), serviceCategory: "HOME_DEEP_CLEANING", client: { ip: visitorIp() }, ...over });

test.before(async () => {
  process.env.PUBLIC_API_TOKEN = TOKEN;
  process.env.PUBLIC_API_HMAC_SECRET = SECRET;
  db = (await import("../src/lib/db")).db;
  leads = await import("../src/app/api/public/v1/leads/route");
  catalogue = await import("../src/app/api/public/v1/catalogue/route");
  slots = await import("../src/app/api/public/v1/slots/route");
  pricing = await import("../src/lib/pricing-master");
  publicPricing = await import("../src/server/pricing");
  resetIdem = (await import("../src/server/public-api")).resetIdempotencyStore;
  await db.user.create({ data: { name: "Test Admin", email: "admin@t", role: "ADMIN" as never, passwordHash: "x" } });
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
});

// ---- authentication (pure) ------------------------------------------------------------------------------------------
test("auth: inert unless BOTH secrets are set and long enough", () => {
  assert.equal(publicApiConfigured({}), false);
  assert.equal(publicApiConfigured({ PUBLIC_API_TOKEN: TOKEN }), false);
  assert.equal(publicApiConfigured({ PUBLIC_API_TOKEN: "short", PUBLIC_API_HMAC_SECRET: SECRET }), false);
  assert.equal(publicApiConfigured({ PUBLIC_API_TOKEN: TOKEN, PUBLIC_API_HMAC_SECRET: "x".repeat(MIN_SECRET_LENGTH - 1) }), false);
  assert.equal(publicApiConfigured({ PUBLIC_API_TOKEN: TOKEN, PUBLIC_API_HMAC_SECRET: SECRET }), true);
  const r = verifyPublicApiRequest({ authorization: `Bearer ${TOKEN}`, timestamp: "1", signature: "x", rawBody: "" }, {});
  assert.deepEqual(r, { ok: false, status: 404 });
});

test("auth: token, timestamp window, signature and body tampering", () => {
  const env = { PUBLIC_API_TOKEN: TOKEN, PUBLIC_API_HMAC_SECRET: SECRET };
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);
  const good = { authorization: `Bearer ${TOKEN}`, timestamp: ts, signature: signPublicApiRequest(SECRET, ts, '{"a":1}'), rawBody: '{"a":1}' };
  assert.deepEqual(verifyPublicApiRequest(good, env, now), { ok: true });
  assert.equal((verifyPublicApiRequest({ ...good, authorization: "Bearer wrong" }, env, now) as { status: number }).status, 401);
  assert.equal((verifyPublicApiRequest({ ...good, authorization: null }, env, now) as { status: number }).status, 401);
  assert.equal((verifyPublicApiRequest({ ...good, rawBody: '{"a":2}' }, env, now) as { status: number }).status, 401, "body tampered after signing");
  assert.equal((verifyPublicApiRequest({ ...good, signature: "sha256=" + "0".repeat(64) }, env, now) as { status: number }).status, 401);
  assert.equal((verifyPublicApiRequest({ ...good, signature: null }, env, now) as { status: number }).status, 401);
  const old = String(now / 1000 - SIGNATURE_MAX_AGE_SECONDS - 1);
  assert.equal((verifyPublicApiRequest({ ...good, timestamp: old, signature: signPublicApiRequest(SECRET, old, '{"a":1}') }, env, now) as { status: number }).status, 401, "stale request (replay)");
  const future = String(now / 1000 + SIGNATURE_MAX_AGE_SECONDS + 1);
  assert.equal((verifyPublicApiRequest({ ...good, timestamp: future, signature: signPublicApiRequest(SECRET, future, '{"a":1}') }, env, now) as { status: number }).status, 401);
  assert.equal((verifyPublicApiRequest({ ...good, timestamp: "abc" }, env, now) as { status: number }).status, 401);
  const edge = String(now / 1000 - SIGNATURE_MAX_AGE_SECONDS);
  assert.deepEqual(verifyPublicApiRequest({ ...good, timestamp: edge, signature: signPublicApiRequest(SECRET, edge, '{"a":1}') }, env, now), { ok: true }, "exactly at the window edge is accepted");
});

// ---- routes: inert and unauthorised --------------------------------------------------------------------------------
test("all three routes answer an empty 404 until the API is configured", async () => {
  const keep = { t: process.env.PUBLIC_API_TOKEN, s: process.env.PUBLIC_API_HMAC_SECRET };
  delete process.env.PUBLIC_API_TOKEN;
  delete process.env.PUBLIC_API_HMAC_SECRET;
  try {
    for (const res of [await leads.POST(req("POST", "/leads", lead())), await catalogue.GET(req("GET", "/catalogue")), await slots.GET(req("GET", "/slots"))]) {
      assert.equal(res.status, 404);
      assert.equal(await res.text(), "", "no body that could reveal the route exists");
    }
  } finally {
    process.env.PUBLIC_API_TOKEN = keep.t;
    process.env.PUBLIC_API_HMAC_SECRET = keep.s;
  }
});

test("bad credentials: 401 with a generic body on every route, and nothing is created", async () => {
  const before = await db.lead.count();
  const bad = [
    await leads.POST(req("POST", "/leads", lead(), { token: "nope" })),
    await leads.POST(req("POST", "/leads", lead(), { sig: "sha256=" + "0".repeat(64) })),
    await leads.POST(req("POST", "/leads", lead(), { token: null })),
    await catalogue.GET(req("GET", "/catalogue", undefined, { token: "nope" })),
    await slots.GET(req("GET", "/slots", undefined, { sig: "sha256=" + "1".repeat(64) })),
  ];
  for (const r of bad) {
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), { error: "Unauthorized.", code: "UNAUTHORIZED" });
  }
  assert.equal(await db.lead.count(), before);
});

// ---- POST /leads -------------------------------------------------------------------------------------------------------
test("leads: a signed booking creates exactly what the booking form creates", async () => {
  const m = mobile();
  const res = await leads.POST(req("POST", "/leads", lead({ mobile: m, name: "Asha Test", area: "Kharadi", serviceDate: ymdPlus(30), timeSlot: "10:00 AM - 12:00 PM" })));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.success, true);
  const [row] = await db.lead.findMany({ where: { mobile: m } });
  assert.equal(row.leadNumber, body.leadNumber);
  assert.equal(row.source, "WEBSITE");
  assert.equal(row.marketingConsent, "UNKNOWN");
  assert.equal(await db.followUp.count({ where: { leadId: row.id } }), 1);
  assert.equal(await db.customer.count({ where: { mobile: m } }), 1);
  assert.equal(await db.whatsAppMessage.count({ where: { relatedId: row.id, kind: "BOOKING_CONFIRMATION" } }), 1);
});

test("leads: request shape errors are 400 VALIDATION", async () => {
  const cases: [string, Request][] = [
    ["no Idempotency-Key", req("POST", "/leads", lead(), { idem: null })],
    ["short Idempotency-Key", req("POST", "/leads", lead(), { idem: "abc" })],
    ["key with bad characters", req("POST", "/leads", lead(), { idem: "has spaces and ! chars" })],
    ["body not JSON", req("POST", "/leads", undefined, { rawBody: "{not json" })],
    ["body is an array", req("POST", "/leads", [1, 2, 3])],
    ["no client", req("POST", "/leads", { name: "Test", mobile: mobile(), serviceCategory: "HOME_DEEP_CLEANING" })],
    ["client.ip not an IP", req("POST", "/leads", lead({ client: { ip: "not-an-ip" } }))],
  ];
  for (const [label, r] of cases) {
    const res = await leads.POST(r as NextRequest);
    assert.equal(res.status, 400, label);
    assert.equal((await res.json()).code, "VALIDATION", label);
  }
  const huge = await leads.POST(req("POST", "/leads", lead({ notes: "x".repeat(120_000) })));
  assert.equal(huge.status, 413);
  assert.equal((await huge.json()).code, "PAYLOAD_TOO_LARGE");
});

test("leads: business refusals map to the documented status and code", async () => {
  const before = await db.lead.count();
  const bad = await leads.POST(req("POST", "/leads", lead({ mobile: "12345" })));
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "Enter a valid 10-digit mobile number", code: "VALIDATION" });

  const past = await leads.POST(req("POST", "/leads", lead({ serviceDate: "2020-01-01" })));
  assert.equal(past.status, 400);
  assert.equal((await past.json()).error, "Please pick today or a future date.");

  const pkg = await leads.POST(req("POST", "/leads", lead({ selectedItems: [{ contentId: "NOPE-999", qty: 1 }] })));
  assert.equal(pkg.status, 409);
  assert.equal((await pkg.json()).code, "PACKAGE_UNAVAILABLE");

  const quote = await leads.POST(req("POST", "/leads", lead({ quotationToken: "x".repeat(10) })));
  assert.equal(quote.status, 400, "an invalid quotation link is a validation error");

  const bot = await leads.POST(req("POST", "/leads", lead({ website: "http://spam.example" })));
  assert.equal(bot.status, 400);
  assert.deepEqual(await bot.json(), { error: "Something went wrong. Please try again.", code: "VALIDATION" }, "the honeypot is not revealed by the code");
  assert.equal(await db.lead.count(), before, "no refusal created a lead");
});

test("leads: a retry with the same Idempotency-Key replays the first answer and creates nothing twice", async () => {
  resetIdem();
  const body = lead();
  const idem = `retry-${randomBytes(6).toString("hex")}`;
  const a = await leads.POST(req("POST", "/leads", body, { idem }));
  const b = await leads.POST(req("POST", "/leads", body, { idem }));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.headers.get("idempotent-replayed"), "true");
  assert.equal(a.headers.get("idempotent-replayed"), null);
  const ja = await a.json();
  assert.deepEqual(await b.json(), ja);
  const row = (await db.lead.findMany({ where: { mobile: body.mobile } }))[0];
  assert.equal(await db.lead.count({ where: { mobile: body.mobile } }), 1);
  assert.equal(await db.timelineEntry.count({ where: { leadId: row.id } }), 1, "the booking logic ran once");
  assert.equal(await db.whatsAppMessage.count({ where: { relatedId: row.id, kind: "BOOKING_CONFIRMATION" } }), 1);

  const other = await leads.POST(req("POST", "/leads", { ...body, name: "Someone Else" }, { idem }));
  assert.equal(other.status, 422, "same key, different request");
  assert.equal((await other.json()).code, "IDEMPOTENCY_MISMATCH");
});

test("leads: two simultaneous requests with one key share one execution", async () => {
  resetIdem();
  const body = lead();
  const idem = `race-${randomBytes(6).toString("hex")}`;
  const [a, b] = await Promise.all([leads.POST(req("POST", "/leads", body, { idem })), leads.POST(req("POST", "/leads", body, { idem }))]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal((await a.json()).leadNumber, (await b.json()).leadNumber);
  assert.equal(await db.lead.count({ where: { mobile: body.mobile } }), 1);
});

test("leads: a refused attempt is never pinned — the corrected request with the same key succeeds", async () => {
  resetIdem();
  const idem = `fix-${randomBytes(6).toString("hex")}`;
  const m = mobile();
  const first = await leads.POST(req("POST", "/leads", lead({ mobile: "12345" }), { idem }));
  assert.equal(first.status, 400);
  const second = await leads.POST(req("POST", "/leads", lead({ mobile: m }), { idem }));
  assert.equal(second.status, 200, "different body + same key is fine after a failure");
});

test("leads: throttling is per VISITOR ip (client.ip), not per website server", async () => {
  resetIdem();
  const ip = "198.51.100.200";
  for (let i = 0; i < 10; i++) assert.equal((await leads.POST(req("POST", "/leads", lead({ client: { ip } })))).status, 200, `request ${i + 1}`);
  const blocked = await leads.POST(req("POST", "/leads", lead({ client: { ip } })));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal((await blocked.json()).code, "THROTTLED");
  const other = await leads.POST(req("POST", "/leads", lead({ client: { ip: "198.51.100.201" } })));
  assert.equal(other.status, 200, "a different visitor is unaffected");
});

test("leads: the server prices the booking; the website's total is ignored", async () => {
  const cat = await (await catalogue.GET(req("GET", `/catalogue?serviceDate=${ymdPlus(400)}`))).json();
  const item = cat.items.find((i: { price: number | null; festivalPackage: boolean; inspectionOnly: boolean; minQty: number | null }) => i.price != null && !i.festivalPackage && !i.inspectionOnly);
  assert.ok(item);
  const m = mobile();
  const res = await leads.POST(req("POST", "/leads", lead({ mobile: m, serviceDate: ymdPlus(400), selectedItems: [{ contentId: item.contentId, qty: 1 }], estimatedAmount: 1 })));
  assert.equal(res.status, 200);
  const [row] = await db.lead.findMany({ where: { mobile: m } });
  assert.equal(row.quoteAmount, item.price * Math.max(1, item.minQty ?? 1), "stored price = the price the catalogue API showed for that date");
});

// ---- GET /catalogue ------------------------------------------------------------------------------------------------------
test("catalogue: shape, caching headers and 304", async () => {
  const res = await catalogue.GET(req("GET", "/catalogue"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.version, /^[0-9a-f]{16}$/);
  assert.match(body.serviceDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(body.items) && body.items.length > 10);
  assert.equal(res.headers.get("etag"), `"${body.version}"`);
  assert.equal(res.headers.get("cache-control"), "private, max-age=30");
  const again = await (await catalogue.GET(req("GET", "/catalogue"))).json();
  assert.equal(again.version, body.version, "deterministic for the same data");
  const notModified = await catalogue.GET(new NextRequest(`${BASE}/catalogue`, { headers: { ...Object.fromEntries(req("GET", "/catalogue").headers), "if-none-match": `"${body.version}"` } }));
  assert.equal(notModified.status, 304);
  assert.equal(await notModified.text(), "");
  assert.equal((await catalogue.GET(req("GET", "/catalogue?serviceDate=2026-13-45"))).status, 400);
});

test("catalogue: honest-pricing invariants hold for every item, on a festival date and a regular date", async () => {
  for (const date of ["2026-10-28", ymdPlus(400)]) { // 28 Oct 2026 is inside the seeded Diwali window
    const body = await (await catalogue.GET(req("GET", `/catalogue?serviceDate=${date}`))).json();
    if (date === "2026-10-28") assert.equal(body.festival?.name, "Diwali");
    else assert.equal(body.festival, null);
    for (const i of body.items as Record<string, unknown>[]) {
      const where = `${i.contentId} on ${date}`;
      if (i.strikePrice != null) {
        assert.ok((i.strikePrice as number) > (i.price as number), `${where}: strike price must be above the price paid`);
        assert.equal(i.savings, (i.strikePrice as number) - (i.price as number), `${where}: savings = strike - price`);
        assert.match(String(i.badge), /^You Save ₹/, where);
      } else assert.equal(i.savings, null, `${where}: no savings without a strike price`);
      if (i.price == null) {
        assert.equal(i.strikePrice, null, where);
        assert.equal(i.badge, null, where);
      }
      if (i.category === "PAINTING") assert.equal(i.price, null, `${where}: painting is never priced publicly`);
      if (i.inspectionOnly) {
        assert.equal(i.price, null, where);
        assert.ok(i.priceNote, `${where}: inspection-only items explain why there is no price`);
      }
    }
  }
});

test("catalogue: the price shown equals what the booking wizard's own pricing code charges for that date", async () => {
  const date = "2026-10-28";
  const body = await (await catalogue.GET(req("GET", `/catalogue?serviceDate=${date}`))).json();
  const live = await publicPricing.getPublicPricing();
  const fest = pricing.festivalForDate(live.festivals, date);
  assert.ok(fest, "the seeded Diwali window covers 28 Oct 2026");
  let checked = 0;
  for (const i of live.items) {
    const api = body.items.find((x: { contentId: string }) => x.contentId === i.contentId);
    assert.ok(api, `${i.contentId} is in the catalogue`);
    assert.equal(api.price, pricing.unitPriceFor(i, fest), `${i.contentId}`);
    checked++;
  }
  assert.ok(checked > 10);
});

// ---- GET /slots ------------------------------------------------------------------------------------------------------------
test("slots: default 21 days, ?days is clamped, ?date gives the slot list, and no internals leak", async () => {
  const def = await (await slots.GET(req("GET", "/slots"))).json();
  assert.equal(def.days.length, 21);
  for (const d of def.days) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["AVAILABLE", "FILLING", "FULL"].includes(d.status));
    assert.equal(typeof d.available, "boolean");
  }
  assert.equal((await (await slots.GET(req("GET", "/slots?days=3"))).json()).days.length, 3);
  assert.equal((await (await slots.GET(req("GET", "/slots?days=1000"))).json()).days.length, 45, "clamped to 45");

  const one = await slots.GET(req("GET", `/slots?date=${ymdPlus(10)}`));
  assert.equal(one.status, 200);
  const day = await one.json();
  assert.equal(day.date, ymdPlus(10));
  assert.ok(Array.isArray(day.slots) && day.slots.length > 0);
  assert.ok(day.slots.every((s: { slot: string; available: boolean }) => typeof s.slot === "string" && typeof s.available === "boolean"));
  for (const k of ["teams", "booked", "dailyCapacity", "dayOverride", "ok"]) assert.equal(k in day, false, `${k} must not be exposed`);

  assert.equal((await slots.GET(req("GET", "/slots?date=2026-02-30"))).status, 400);
  assert.equal((await slots.GET(req("GET", "/slots?date=tomorrow"))).status, 400);
});
