// Characterisation tests for publicBookLead (2026-10-22) — they pin down what the public booking action does TODAY,
// so it can be moved into a REST endpoint (docs/website/public-api-v1.openapi.yaml) without changing behaviour.
// Run: npm run test:publicbooking
//
// Safe by construction: a fresh throwaway SQLite DB (scripts/db-setup.mjs) — never dev.db or production; the
// WhatsApp / Google Sheet env vars are removed so nothing leaves this process; mobiles are fake (90000000xx).
// Next's request-only APIs (next/cache, next/headers) are stubbed.
//
// NOT covered yet (known gaps): slot-full rejection, the quotation-link path (bookFromQuotation), the WhatsApp
// template branch (WHATSAPP_USE_TEMPLATES=on), upsell events, booking-link close-out, festival-window pricing
// (depends on today's date).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ---- environment: isolated DB, no outbound channels --------------------------------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), "sahara-pubbook-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_OUTBOUND_MODE", "LEADS_SHEET_WEBHOOK_URL", "LEADS_SHEET_WEBHOOK_SECRET"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

// ---- stubs for request-scoped Next APIs ---------------------------------------------------------------------------
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
const revalidated: string[] = [];
let reqHeaders: Headers | null = null; // null = outside a request (internal call): throttling is skipped
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: (p: string) => void revalidated.push(p), revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (request === "next/headers") return { headers: async () => { if (!reqHeaders) throw new Error("outside request scope"); return reqHeaders; } };
  return realLoad.call(this, request, parent, isMain);
};

type Db = typeof import("../src/lib/db").db;
let db: Db;
let book: (v: unknown) => Promise<{ success?: true; leadNumber?: string; error?: string }>;
let pricing: typeof import("../src/lib/pricing-master");
let publicPricing: typeof import("../src/server/pricing");

const ymdPlus = (days: number) => new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
let n = 0;
const mobile = () => `90000000${String(10 + n++).padStart(2, "0")}`; // 9000000010, 9000000011, … (fake)
const base = (over: Record<string, unknown> = {}) => ({ name: "Test Customer", mobile: mobile(), serviceCategory: "HOME_DEEP_CLEANING", ...over });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  book = (await import("../src/server/actions/public-booking")).publicBookLead as typeof book;
  pricing = await import("../src/lib/pricing-master");
  publicPricing = await import("../src/server/pricing");
  await db.user.create({ data: { name: "Test Admin", email: "admin@t", role: "ADMIN" as never, passwordHash: "x" } });
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect(); // Windows keeps the SQLite file locked until the client is closed
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir; the OS cleans it up */ }
});

const leadsFor = (m: string) => db.lead.findMany({ where: { mobile: m }, orderBy: { createdAt: "asc" } });

// ---- validation ----------------------------------------------------------------------------------------------------
test("rejects bad input with a human message and creates nothing", async () => {
  const before = await db.lead.count();
  assert.equal((await book(base({ name: "A" }))).error, "Name is required");
  assert.equal((await book(base({ mobile: "12345" }))).error, "Enter a valid 10-digit mobile number");
  assert.equal((await book(base({ mobile: "5000000000" }))).error, "Enter a valid 10-digit mobile number");
  assert.equal((await book(base({ serviceCategory: "" }))).error, "Pick a service");
  assert.equal((await book(base({ email: "not-an-email" }))).error, "Enter a valid email");
  assert.equal((await book(base({ serviceDate: "2020-01-01" }))).error, "Please pick today or a future date.");
  assert.equal((await book(base({ serviceDate: "2026-13-45" }))).error, "Please pick a valid service date.");
  assert.equal(await db.lead.count(), before, "no lead was created by any rejected request");
});

test("honeypot: a filled hidden field gets a generic error and no lead", async () => {
  const m = mobile();
  const r = await book(base({ mobile: m, website: "http://spam.example" }));
  assert.equal(r.error, "Something went wrong. Please try again.");
  assert.equal((await leadsFor(m)).length, 0);
});

// ---- happy path and its side effects -------------------------------------------------------------------------------
test("a valid booking creates lead, follow-up, timeline, customer, acknowledgement and alert", async () => {
  revalidated.length = 0;
  const m = mobile();
  const r = await book(base({ mobile: m, name: "Asha Test", area: "Kharadi", address: "Flat 1, Test Road", pinCode: "411014", serviceDate: ymdPlus(30), timeSlot: "10:00 AM - 12:00 PM", notes: "gate code 1234" }));
  assert.equal(r.success, true);
  assert.match(r.leadNumber ?? "", /^[A-Z]+-?\d+/);
  const [lead] = await leadsFor(m);
  assert.equal(lead.leadNumber, r.leadNumber);
  assert.equal(lead.name, "Asha Test");
  assert.equal(lead.whatsapp, m, "WhatsApp number defaults to the mobile");
  assert.equal(lead.source, "WEBSITE");
  assert.equal(lead.area, "Kharadi");
  assert.equal(lead.service, "HOME_DEEP_CLEANING");
  assert.equal(lead.timeSlot, "10:00 AM - 12:00 PM");
  assert.ok(lead.formSubmittedAt, "formSubmittedAt is stamped");
  assert.equal(lead.marketingConsent, "UNKNOWN", "marketing consent is never assumed");

  const fu = await db.followUp.findMany({ where: { leadId: lead.id } });
  assert.equal(fu.length, 1);
  assert.equal(fu[0].type, "CALL");
  assert.equal(fu[0].priority, "HIGH");
  const mins = (fu[0].dueDate.getTime() - Date.now()) / 60_000;
  assert.ok(mins > 10 && mins <= 16, `call-back due in ~15 min (was ${mins.toFixed(1)})`);

  const tl = await db.timelineEntry.findMany({ where: { leadId: lead.id } });
  assert.equal(tl.length, 1);
  assert.match(tl[0].body, /Booked online/);
  assert.match(tl[0].body, /unverified — no OTP yet/);

  assert.equal(await db.customer.count({ where: { mobile: m } }), 1, "one customer record per mobile");
  const ack = await db.whatsAppMessage.findMany({ where: { relatedType: "Lead", relatedId: lead.id, kind: "BOOKING_CONFIRMATION" } });
  assert.equal(ack.length, 1, "one request acknowledgement (queued — no WhatsApp credentials in this test)");
  assert.equal(await db.notification.count({ where: { kind: "NEW_BOOKING" } }) > 0, true, "staff are alerted");
  assert.deepEqual(revalidated.slice(-2), ["/leads", "/dashboard"]);
});

// ---- duplicates ----------------------------------------------------------------------------------------------------
test("same mobile + same service updates the open enquiry; a different service is a new lead; one customer; one ack per day", async () => {
  const m = mobile();
  const a = await book(base({ mobile: m }));
  const b = await book(base({ mobile: m, notes: "second submit" }));
  assert.equal(b.leadNumber, a.leadNumber, "repeat submission reuses the lead number");
  assert.equal((await leadsFor(m)).length, 1);
  const c = await book(base({ mobile: m, serviceCategory: "PEST_CONTROL" }));
  assert.notEqual(c.leadNumber, a.leadNumber, "different service = new enquiry");
  assert.equal((await leadsFor(m)).length, 2);
  assert.equal(await db.customer.count({ where: { mobile: m } }), 1, "still one customer for the mobile");
  const first = (await leadsFor(m))[0];
  assert.equal(await db.whatsAppMessage.count({ where: { relatedId: first.id, kind: "BOOKING_CONFIRMATION" } }), 1, "no second acknowledgement within 24 h");
  const tl = await db.timelineEntry.findMany({ where: { leadId: first.id } });
  assert.ok(tl.some((t) => /no duplicate lead created/.test(t.body)), "the repeat is noted on the timeline");
});

// ---- trust boundary: price and payment ----------------------------------------------------------------------------
test("the browser's estimate and 'advance paid' claim are never trusted", async () => {
  const m = mobile();
  const r = await book(base({ mobile: m, estimatedAmount: 1, advancePaid: true, advanceAmount: 5000, paymentMode: "UPI" }));
  assert.equal(r.success, true);
  const [lead] = await leadsFor(m);
  assert.equal(lead.quoteAmount, null, "no catalogue items => no stored price");
  assert.equal(lead.advanceAmount, null);
  assert.equal(lead.paymentStatus, "PENDING_ADVANCE");
  assert.equal(await db.payment.count({ where: { leadId: lead.id } }), 0, "no Payment row is created by a public request");
  const tl = await db.timelineEntry.findFirst({ where: { leadId: lead.id } });
  assert.match(tl!.body, /UNVERIFIED/);
});

test("catalogue bookings are re-priced on the server from live pricing", async () => {
  const pp = await publicPricing.getPublicPricing();
  const item = pp.items.find((i) => !pricing.FESTIVAL_PACKAGE_IDS.has(i.contentId) && !pricing.INSPECTION_ONLY_IDS.has(i.contentId) && pricing.unitPriceFor(i, null) != null);
  assert.ok(item, "the seeded catalogue has at least one plainly priced item");
  const qty = 2;
  const expected = pricing.unitPriceFor(item!, null)! * Math.max(qty, item!.minQty ?? 1);
  const m = mobile();
  // a date far outside any festival window, and a client total that must be ignored
  const r = await book(base({ mobile: m, serviceDate: ymdPlus(400), selectedItems: [{ contentId: item!.contentId, qty }], estimatedAmount: 99999 }));
  assert.equal(r.success, true, r.error);
  const [lead] = await leadsFor(m);
  assert.equal(lead.quoteAmount, expected, "stored price = server price, not the client's 99999");
  assert.equal(lead.priceType, "REGULAR");
  assert.ok(lead.scopeOfWork, "a scope-of-work snapshot is stored with the price");
});

test("an unknown package id is refused", async () => {
  const r = await book(base({ selectedItems: [{ contentId: "NOPE-999", qty: 1 }] }));
  assert.equal(r.error, "A selected package is no longer available — please refresh the page.");
});

test("4 BHK and larger / villas: no instant price, inspection note on follow-up and timeline", async () => {
  const pp = await publicPricing.getPublicPricing();
  const item = pp.items.find((i) => !pricing.FESTIVAL_PACKAGE_IDS.has(i.contentId) && !pricing.INSPECTION_ONLY_IDS.has(i.contentId) && pricing.unitPriceFor(i, null) != null)!;
  const m = mobile();
  const r = await book(base({ mobile: m, propertyType: "Villa", serviceDate: ymdPlus(400), selectedItems: [{ contentId: item.contentId, qty: 1 }] }));
  assert.equal(r.success, true, r.error);
  const [lead] = await leadsFor(m);
  assert.equal(lead.quoteAmount, null);
  assert.equal(lead.priceType, null);
  const fu = await db.followUp.findFirst({ where: { leadId: lead.id } });
  assert.match(fu!.notes ?? "", /inspection/i);
  const tl = await db.timelineEntry.findFirst({ where: { leadId: lead.id } });
  assert.match(tl!.body, /SITE INSPECTION REQUIRED/);
});

// ---- consent and attribution ---------------------------------------------------------------------------------------
test("WhatsApp marketing opt-in is recorded only when ticked", async () => {
  const yes = mobile(), no = mobile();
  await book(base({ mobile: yes, marketingOptIn: true }));
  await book(base({ mobile: no }));
  const [a] = await leadsFor(yes);
  const [b] = await leadsFor(no);
  assert.equal(a.marketingConsent, "OPTED_IN");
  assert.ok(a.marketingConsentAt);
  assert.equal(b.marketingConsent, "UNKNOWN");
});

test("first-touch attribution is stored; explicit source wins over the detected channel", async () => {
  const m = mobile();
  await book(base({ mobile: m, source: "gmb", attribution: { first: { source: "google", medium: "cpc", campaign: "pune_deep", gclid: "TESTGCLID", landingPage: "/home-deep-cleaning-pune", at: new Date().toISOString() } } }));
  const [lead] = await leadsFor(m);
  assert.equal(lead.gclid, "TESTGCLID");
  assert.equal(lead.utmSource, "google");
  assert.equal(lead.utmCampaign, "pune_deep");
  assert.equal(lead.landingPage, "/home-deep-cleaning-pune");
  assert.ok(lead.acquisitionChannel, "a channel is classified");
  assert.equal(lead.source, "GMB", "the customer's own 'how did you hear' answer wins");
});

// ---- throttling (needs a request scope: the caller IP comes from the request headers) ------------------------------
test("throttle: 10 requests per IP, 5 per mobile, per 10 minutes", async () => {
  reqHeaders = new Headers({ "x-forwarded-for": "203.0.113.7" });
  try {
    for (let i = 0; i < 10; i++) assert.equal((await book(base())).success, true, `request ${i + 1} from one IP is allowed`);
    const r = await book(base());
    assert.equal(r.error, "Too many requests — please wait a few minutes or call us to book.");
    // per mobile: a fresh IP each time, same mobile
    const m = mobile();
    for (let i = 0; i < 5; i++) {
      reqHeaders = new Headers({ "x-forwarded-for": `198.51.100.${i + 1}` });
      assert.equal((await book(base({ mobile: m }))).success, true);
    }
    reqHeaders = new Headers({ "x-forwarded-for": "198.51.100.99" });
    assert.equal((await book(base({ mobile: m }))).error, "Too many requests — please wait a few minutes or call us to book.");
  } finally {
    reqHeaders = null;
  }
});
