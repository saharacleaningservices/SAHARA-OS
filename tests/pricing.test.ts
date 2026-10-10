// Regression tests: approved prices, inspection-only properties, payment trust, AI draft quote (2026-10-09).
// Run: npm run test:pricing   (uses throwaway SQLite DBs — never dev.db or production)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  PRICING_MASTER,
  INSPECTION_ONLY_IDS,
  HOME_FROM_PRICE,
  festivalForDate,
  needsInspection,
  priceByContentId,
  unitPriceFor,
  type FestivalWindow,
} from "../src/lib/pricing-master";
import { activeCampaign, homeFromPrice, FESTIVAL_PACKAGE_IDS, maskPaintingPrices, PAINTING_PUBLIC_NOTE } from "../src/lib/pricing-master";
import { livePkgs, reviewCountLabel } from "../src/lib/marketing-content";
import { publicPaymentState, resolvePublicEstimate } from "../src/lib/booking-payment";
import { resolvePackageEstimate } from "../src/lib/lead-estimate";
import { redactJob, redactLead } from "../src/lib/redact";
import { readdirSync, readFileSync } from "node:fs";
import { draftQuotation } from "../src/lib/ai/quotation";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "../src/lib/whatsapp-keywords";
import { staffBalanceToCollect, jobPaymentSummary } from "../src/lib/payment-status";
import { leadSchema, jobSchema } from "../src/lib/validation";
import { packageTotals } from "../src/lib/package-calc";
import { reviewRequestMessage, premiumReviewRequestMessage, premiumBookingConfirmationMessage, documentShareMessage } from "../src/lib/whatsapp-templates";
import { documentScope } from "../src/lib/document-scope";
import { maskJobCardForAudience } from "../src/lib/pdf/job-card-mask";
import { compactServiceLines, isAutoScope } from "../src/lib/service-scope";

const item = (id: string) => priceByContentId(id)!;

const FESTIVAL_FINAL: Record<string, number> = {
  "SCS-01": 4999, // 1 BHK Premium
  "SCS-05": 6499, // 1 BHK Platinum
  "SCS-02": 5499, // 2 BHK Premium
  "SCS-06": 6999, // 2 BHK Platinum
  "SCS-03": 6999, // 3 BHK Premium
  "SCS-07": 8499, // 3 BHK Platinum
};

test("regular Premium selling prices", () => {
  assert.equal(item("SCS-01").price, 4499);
  assert.equal(item("SCS-02").price, 5499);
  assert.equal(item("SCS-03").price, 6999);
  assert.equal(HOME_FROM_PRICE, 4499);
});

test("retired selling prices are gone and no fake MRP is shown on Premium 1-3 BHK", () => {
  for (const id of ["SCS-01", "SCS-02", "SCS-03"]) {
    assert.ok(![4000, 4999, 6499].includes(item(id).price!), `${id} still has a retired price`);
    assert.equal(item(id).mrp, undefined);
  }
});

test("regular Platinum 1-3 BHK unchanged", () => {
  assert.equal(item("SCS-05").price, 5499);
  assert.equal(item("SCS-06").price, 6499);
  assert.equal(item("SCS-07").price, 7999);
});

test("4 BHK Premium/Platinum are inspection-only: no price, with a note", () => {
  for (const id of ["SCS-04", "SCS-08"]) {
    assert.equal(item(id).price, null);
    assert.ok(item(id).priceNote?.toLowerCase().includes("inspection"));
    assert.ok(INSPECTION_ONLY_IDS.has(id));
  }
});

test("inspection-only items stay unpriced even with a festival price or an override", () => {
  const w: FestivalWindow = { id: "f", name: "X", start: "2026-10-01", end: "2026-10-19", prices: { "SCS-04": 9999, "SCS-08": 9999 } };
  assert.equal(unitPriceFor(item("SCS-04"), w), null);
  assert.equal(unitPriceFor({ ...item("SCS-08"), price: 12345 }, null), null);
});

test("needsInspection: 4 BHK+, 5 BHK, villa, bungalow, full house, other; not 1-3 BHK", () => {
  for (const t of ["4 BHK", "5 BHK", "4 BHK+", "6 bhk", "Villa", "Bungalow", "Villa / Bungalow", "Full House", "Other"]) assert.equal(needsInspection(t), true, t);
  for (const t of ["1 BHK", "2 BHK", "3 BHK", "", undefined, null, "Commercial/Office"]) assert.equal(needsInspection(t as string | null | undefined), false, String(t));
});

test("package ids unique", () => {
  const ids = PRICING_MASTER.map((p) => p.contentId);
  assert.equal(new Set(ids).size, ids.length);
});

test("festival window pricing applies only inside the dates; otherwise regular", () => {
  const w: FestivalWindow = { id: "f", name: "Diwali", start: "2026-10-26", end: "2026-11-10", prices: FESTIVAL_FINAL };
  assert.equal(festivalForDate([w], "2026-10-25"), null);
  assert.equal(festivalForDate([w], "2026-11-11"), null);
  assert.equal(festivalForDate([w], "2026-10-26"), w);
  for (const [id, price] of Object.entries(FESTIVAL_FINAL)) assert.equal(unitPriceFor(item(id), w), price, id);
  assert.equal(unitPriceFor(item("SCS-01"), null), 4499); // outside festival → regular
});

const WINDOWS: FestivalWindow[] = [
  { id: "n", name: "Navratri", start: "2026-10-01", end: "2026-10-19", prices: FESTIVAL_FINAL },
  { id: "d", name: "Dussehra", start: "2026-10-20", end: "2026-10-25", prices: FESTIVAL_FINAL },
  { id: "w", name: "Diwali", start: "2026-10-26", end: "2026-11-10", prices: FESTIVAL_FINAL },
];

test("activeCampaign: active only between the first start and last end; picks the current window", () => {
  assert.equal(activeCampaign([], "2026-10-09"), null);
  assert.equal(activeCampaign(WINDOWS, "2026-09-30"), null); // before it starts → regular shows
  assert.equal(activeCampaign(WINDOWS, "2026-11-11"), null); // after it ends → regular restored
  assert.equal(activeCampaign(WINDOWS, "2026-10-09")?.current.name, "Navratri");
  assert.equal(activeCampaign(WINDOWS, "2026-10-22")?.current.name, "Dussehra");
  assert.equal(activeCampaign(WINDOWS, "2026-11-10")?.current.name, "Diwali");
  const gap: FestivalWindow[] = [WINDOWS[0], { ...WINDOWS[2], start: "2026-10-26" }];
  assert.equal(activeCampaign(gap, "2026-10-22")?.current.name, "Diwali"); // a gap inside the campaign stays festival-only
});

test("landing grids: festival prices only during the campaign (no MRP / regular); regular after", () => {
  const items = PRICING_MASTER;
  const fest = livePkgs(items, "PREMIUM", WINDOWS[0]);
  assert.deepEqual(fest.map((p) => p.price), [4999, 5499, 6999, null]);
  assert.ok(fest.every((p) => p.mrp === null), "no regular MRP/savings during the campaign");
  assert.deepEqual(livePkgs(items, "PLATINUM", WINDOWS[0]).map((p) => p.price), [6499, 6999, 8499, null]);
  // campaign over → regular grids restored
  assert.deepEqual(livePkgs(items, "PREMIUM").map((p) => p.price), [4499, 5499, 6999, null]);
  assert.deepEqual(livePkgs(items, "PLATINUM").map((p) => p.price), [5499, 6499, 7999, null]);
  assert.equal(homeFromPrice(items, WINDOWS[0]), 4999);
  assert.equal(homeFromPrice(items, null), 4499);
});

test("exactly the six 1-3 BHK Premium/Platinum packages carry festival prices", () => {
  assert.deepEqual([...FESTIVAL_PACKAGE_IDS].sort(), Object.keys(FESTIVAL_FINAL).sort());
});

test("public painting rates are withheld; every other price (incl. festival packages) is untouched", () => {
  const masked = maskPaintingPrices(PRICING_MASTER);
  const paint = masked.filter((i) => i.group === "PAINTING");
  assert.ok(paint.length > 0);
  for (const p of paint) {
    assert.equal(p.price, null, `${p.contentId} still priced`);
    assert.equal(p.mrp, undefined);
    assert.equal(p.priceNote, PAINTING_PUBLIC_NOTE);
  }
  // nothing else changes
  for (const [i, m] of masked.entries()) if (m.group !== "PAINTING") assert.deepEqual(m, PRICING_MASTER[i]);
  // festival packages still exact after masking
  const w: FestivalWindow = { id: "f", name: "Navratri", start: "2026-10-01", end: "2026-10-19", prices: FESTIVAL_FINAL };
  for (const [id, price] of Object.entries(FESTIVAL_FINAL)) assert.equal(unitPriceFor(masked.find((x) => x.contentId === id)!, w), price, id);
  // the master itself (staff/CRM source) keeps the painting rates
  assert.ok(PRICING_MASTER.filter((i) => i.group === "PAINTING").some((p) => p.price != null));
});

test("CRM New Lead estimate: 2 BHK → 4 BHK / Villa drops the stale auto estimate; switching back re-prices", () => {
  // Step 1: 2 BHK Premium on a regular date → form auto-fills ₹5,499.
  const s1 = resolvePackageEstimate({ amount: null, source: "NONE" }, { propertyType: "2 BHK", price: 5499 });
  assert.deepEqual([s1.amount, s1.source, s1.mode, s1.warnManual], [5499, "AUTO", "PRICED", false]);
  // Step 2: property type changed to 4 BHK (no price) → the auto amount must be cleared.
  const s2 = resolvePackageEstimate(s1, { propertyType: "4 BHK", price: null });
  assert.deepEqual([s2.amount, s2.source, s2.mode, s2.warnManual], [null, "NONE", "INSPECTION", false]);
  // Same from 2 BHK → Villa (no catalogue item at all).
  const v = resolvePackageEstimate(s1, { propertyType: "Villa", price: null });
  assert.deepEqual([v.amount, v.source, v.mode], [null, "NONE", "INSPECTION"]);
  for (const t of ["5 BHK", "Bungalow", "Other"]) assert.equal(resolvePackageEstimate(s1, { propertyType: t, price: null }).amount, null, t);
  // Step 3: back to a priced package → auto-fills again (festival-date price included).
  const s3 = resolvePackageEstimate(s2, { propertyType: "3 BHK", price: 6999 });
  assert.deepEqual([s3.amount, s3.source, s3.mode], [6999, "AUTO", "PRICED"]);
  const s4 = resolvePackageEstimate(s3, { propertyType: "3 BHK", price: 8499 });
  assert.equal(s4.amount, 8499); // auto estimate follows the new price
});

test("CRM New Lead estimate: a manual staff estimate is preserved but flagged on inspection-only types", () => {
  const manual = { amount: 12000, source: "MANUAL" as const };
  const onVilla = resolvePackageEstimate(manual, { propertyType: "Villa", price: null });
  assert.deepEqual([onVilla.amount, onVilla.source, onVilla.mode, onVilla.warnManual], [12000, "MANUAL", "INSPECTION", true]);
  const on4 = resolvePackageEstimate(manual, { propertyType: "4 BHK", price: null });
  assert.equal(on4.warnManual, true);
  // A manual figure is never overwritten by a package price.
  const onPriced = resolvePackageEstimate(manual, { propertyType: "2 BHK", price: 5499 });
  assert.deepEqual([onPriced.amount, onPriced.source, onPriced.warnManual], [12000, "MANUAL", false]);
  // An existing saved lead's amount (treated as MANUAL by the form) is never silently cleared.
  assert.equal(resolvePackageEstimate({ amount: 5500, source: "MANUAL" }, { propertyType: "4 BHK", price: null }).amount, 5500);
  // Nothing typed and nothing auto-filled: stays empty and unwarned.
  const empty = resolvePackageEstimate({ amount: null, source: "NONE" }, { propertyType: "Villa", price: null });
  assert.deepEqual([empty.amount, empty.warnManual, empty.mode], [null, false, "INSPECTION"]);
  // A non-inspection selection with no price (e.g. Diamond) is UNPRICED, auto estimate dropped.
  const unpriced = resolvePackageEstimate({ amount: 5499, source: "AUTO" }, { propertyType: "2 BHK", price: null });
  assert.deepEqual([unpriced.amount, unpriced.mode], [null, "UNPRICED"]);
});

test("CRM manual quote: survives property/package changes; Reset re-prices from the current package price (regular or festival)", () => {
  const item = (id: string) => priceByContentId(id)!;
  const festival = { name: "Diwali", prices: { "SCS-02": 5499, "SCS-06": 6999 } } as unknown as FestivalWindow;
  // A manual ₹6,200 quote on 2 BHK Premium, then 3 BHK, Villa, back to 2 BHK, then Platinum: never overwritten.
  let st: { amount: number | null; source: "MANUAL" | "AUTO" | "NONE" } = { amount: 6200, source: "MANUAL" };
  for (const [t, id] of [["3 BHK", "SCS-03"], ["Villa", null], ["2 BHK", "SCS-02"], ["2 BHK", "SCS-06"]] as const) {
    const r = resolvePackageEstimate(st, { propertyType: t, price: id ? unitPriceFor(item(id), null) : null });
    assert.deepEqual([r.amount, r.source], [6200, "MANUAL"], `${t} ${id}`);
    st = r;
  }
  // Reset (the explicit button): amount := current package price, source := AUTO.
  // No service date → regular Platinum 2 BHK; inside the festival window → festival price.
  assert.equal(unitPriceFor(item("SCS-06"), null), 6499);
  assert.equal(unitPriceFor(item("SCS-06"), festival), 6999);
  const reset = { amount: unitPriceFor(item("SCS-06"), festival), source: "AUTO" as const };
  // After Reset the estimate follows package changes again.
  const after = resolvePackageEstimate(reset, { propertyType: "2 BHK", price: unitPriceFor(item("SCS-02"), festival) });
  assert.deepEqual([after.amount, after.source], [5499, "AUTO"]);
});

test("CRM property types: every selectable type is either priced 1-3 BHK, or inspection-only", () => {
  const types = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Bungalow", "Commercial/Office", "Other"];
  const inspection = types.filter((t) => needsInspection(t));
  assert.deepEqual(inspection, ["4 BHK", "5 BHK", "Villa", "Bungalow", "Other"]);
  assert.equal(needsInspection("Commercial/Office"), false); // commercial uses its own quotation workflow
  for (const t of inspection) assert.equal(resolvePackageEstimate({ amount: 5499, source: "AUTO" }, { propertyType: t, price: null }).amount, null, t);
});

test("field staff never receive customer phone numbers or job money; office roles keep them", () => {
  const job = { id: "j1", customerMobile: "9876543210", alternateMobile: "9123456780", jobValue: 5499, discountAmount: 100, publicToken: "tok", notes: "call 9876543210 total = ₹5,499", payments: [{ amount: 5499, paidAmount: 2000 }] };
  for (const role of ["STAFF", "SUPERVISOR"]) {
    const r = redactJob(job, role);
    assert.equal(r.customerMobile, "", role);
    assert.equal(r.alternateMobile, null);
    assert.equal(r.jobValue, 0);
    assert.equal(r.publicToken, null);
    assert.deepEqual(r.payments, [{ amount: 0, paidAmount: 0 }]);
    assert.ok(!/9876543210|5,499/.test(String(r.notes)), `${role} notes leak: ${r.notes}`);
  }
  // Operations sees the job amount but never the customer's number.
  const ops = redactJob(job, "OPERATIONS");
  assert.equal(ops.customerMobile, "");
  assert.equal(ops.jobValue, 5499);
  // Admin / Accounts see everything.
  for (const role of ["ADMIN", "ACCOUNTS"]) {
    const r = redactJob(job, role);
    assert.equal(r.customerMobile, "9876543210");
    assert.equal(r.jobValue, 5499);
  }
  const lead = { mobile: "9876543210", whatsapp: "9876543210", email: "a@b.in", quoteAmount: 5499, advanceAmount: 1000 };
  const l = redactLead(lead, "STAFF");
  assert.deepEqual([l.mobile, l.whatsapp, l.email, l.quoteAmount, l.advanceAmount], ["", null, null, null, null]);
});

test("project rule: the name 'Shweta' appears nowhere in application source (Accounts is Shoaib Qazi)", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/node_modules|generated|\.next/.test(e.name)) walk(p); }
      else if (/\.(ts|tsx|mjs|json|prisma)$/.test(e.name) && /shweta/i.test(readFileSync(p, "utf8"))) hits.push(p);
    }
  };
  for (const d of ["src", "scripts", "prisma"]) walk(path.join(process.cwd(), d));
  assert.deepEqual(hits, []);
});

test("forged public payment: browser can never create PAID / a Payment row / collected revenue", () => {
  const forged = publicPaymentState({ advancePaid: true, advanceAmount: 999999 });
  assert.equal(forged.advance, 0);
  assert.equal(forged.paymentStatus, "PENDING_ADVANCE");
  assert.equal(forged.createPaymentRow, false);
  assert.equal(forged.declaredAdvance, 999999); // kept only as an UNVERIFIED staff note
  const normal = publicPaymentState({});
  assert.deepEqual([normal.advance, normal.paymentStatus, normal.declaredAdvance, normal.createPaymentRow], [0, "PENDING_ADVANCE", 0, false]);
  assert.equal(publicPaymentState({ advancePaid: false, advanceAmount: 500 }).declaredAdvance, 0);
});

test("browser estimate never becomes the quote; server catalogue total is authoritative", () => {
  assert.deepEqual(resolvePublicEstimate({ catalogueTotal: 5499, clientEstimate: 1 }), { quoteAmount: 5499, unverifiedClientEstimate: null });
  assert.deepEqual(resolvePublicEstimate({ catalogueTotal: null, clientEstimate: 7777 }), { quoteAmount: null, unverifiedClientEstimate: 7777 });
  assert.deepEqual(resolvePublicEstimate({ catalogueTotal: null, clientEstimate: 0 }), { quoteAmount: null, unverifiedClientEstimate: null });
});

test("AI draft quote has no generic fallback price", () => {
  const none = draftQuotation({ name: "A", service: "HOME_DEEP_CLEANING", area: "Kharadi", quoteAmount: null });
  assert.equal(none.total, 0);
  assert.ok(!/4,?999|₹/.test(none.message), "unpriced draft must not state any amount");
  const priced = draftQuotation({ name: "A", service: "HOME_DEEP_CLEANING", area: "Kharadi", quoteAmount: 5499 });
  assert.equal(priced.total, 5499);
  assert.ok(priced.message.includes("5,499"));
});

function readFestival(dbFile: string) {
  const db = new Database(dbFile, { readonly: true });
  const rows = db
    .prepare(`SELECT f."name" AS n, p."contentId" AS c, p."price" AS price FROM "FestivalPrice" p JOIN "FestivalOffer" f ON f."id"=p."festivalId" ORDER BY f."name", p."contentId"`)
    .all() as { n: string; c: string; price: number }[];
  db.close();
  return rows;
}
const runSetup = (dbFile: string) => execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "pipe" });

test("migration on an EMPTY DB: all six exact festival prices in every offer; later admin edits survive a re-run", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-price-"));
  const dbFile = path.join(dir, "t.db");
  try {
    runSetup(dbFile);
    const rows = readFestival(dbFile);
    for (const name of ["Navratri", "Dussehra", "Diwali"]) {
      const m = Object.fromEntries(rows.filter((r) => r.n === name).map((r) => [r.c, r.price]));
      for (const [id, price] of Object.entries(FESTIVAL_FINAL)) assert.equal(m[id], price, `${name} ${id}`);
      assert.equal(m["SCS-04"], undefined);
      assert.equal(m["SCS-08"], undefined);
    }
    const db = new Database(dbFile);
    db.prepare(`UPDATE "FestivalPrice" SET "price" = 9999 WHERE "contentId" = 'SCS-02'`).run();
    db.close();
    runSetup(dbFile);
    assert.ok(readFestival(dbFile).filter((r) => r.c === "SCS-02").every((r) => r.price === 9999), "admin edit was reset");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("migration on a production-like DB (old seeded festival prices, no marker) updates once, keeps history untouched", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-price-"));
  const dbFile = path.join(dir, "p.db");
  try {
    runSetup(dbFile);
    const db = new Database(dbFile);
    // Recreate the pre-approval state: old festival values, no migration marker, an old regular override.
    db.prepare(`DELETE FROM "PriceSetting" WHERE "contentId" LIKE '_migration:owner-price-sync%'`).run();
    const old: Record<string, number> = { "SCS-01": 5000, "SCS-05": 6500, "SCS-02": 5500, "SCS-06": 7000, "SCS-03": 7000, "SCS-07": 8500 };
    for (const [id, price] of Object.entries(old)) db.prepare(`UPDATE "FestivalPrice" SET "price" = ? WHERE "contentId" = ?`).run(price, id);
    db.prepare(`INSERT OR REPLACE INTO "PriceSetting" ("contentId","price","mrp","isActive","updatedByName","updatedAt") VALUES ('SCS-02', 4999, 5499, 1, 'Admin', '2026-10-01T00:00:00.000+00:00')`).run();
    db.prepare(`INSERT OR REPLACE INTO "PriceSetting" ("contentId","price","mrp","isActive","updatedByName","updatedAt") VALUES ('SCS-03', 6000, NULL, 1, 'Admin', '2026-10-01T00:00:00.000+00:00')`).run();
    const jobsBefore = (db.prepare(`SELECT count(*) c FROM "Job"`).get() as { c: number }).c;
    db.close();
    runSetup(dbFile);
    const after = readFestival(dbFile);
    for (const [id, price] of Object.entries(FESTIVAL_FINAL)) assert.ok(after.filter((r) => r.c === id).every((r) => r.price === price), id);
    const chk = new Database(dbFile, { readonly: true });
    const s2 = chk.prepare(`SELECT price, mrp FROM "PriceSetting" WHERE "contentId"='SCS-02'`).get() as { price: number; mrp: number | null };
    const s3 = chk.prepare(`SELECT price FROM "PriceSetting" WHERE "contentId"='SCS-03'`).get() as { price: number };
    assert.deepEqual([s2.price, s2.mrp], [5499, null]); // retired override (4999) replaced
    assert.equal(s3.price, 6000); // a different admin override is NOT touched
    assert.equal((chk.prepare(`SELECT count(*) c FROM "Job"`).get() as { c: number }).c, jobsBefore);
    chk.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WhatsApp: STOP-style replies opt out; a booking CANCEL never unsubscribes", () => {
  for (const w of ["STOP", "stop", " Stop ", "UNSUBSCRIBE", "opt out", "OptOut"]) {
    assert.ok(OPT_OUT_KEYWORDS.test(w.trim()), `${w} should opt out`);
  }
  for (const w of ["CANCEL", "cancel", "Cancel", "cancel my booking", "please stop the cleaner", "cancel booking"]) {
    assert.ok(!OPT_OUT_KEYWORDS.test(w.trim()), `${w} must NOT opt out`);
  }
  // START still resubscribes; CANCEL is not an opt-in either.
  assert.ok(OPT_IN_KEYWORDS.test("START") && OPT_IN_KEYWORDS.test("subscribe"));
  assert.ok(!OPT_IN_KEYWORDS.test("cancel"));
});

test("staff app (real DB): own job shows ONLY balance to collect; no phone, token, notes, job amount or paid; other jobs denied", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-staff-"));
  const dbFile = path.join(dir, "s.db");
  const prevUrl = process.env.DATABASE_URL;
  try {
    runSetup(dbFile);
    process.env.DATABASE_URL = `file:${dbFile}`;
    const { db } = await import("../src/lib/db");
    const { getMyJob, getMyDay } = await import("../src/server/staff-portal");
    const me = await db.staff.create({ data: { employeeCode: "T-ME", name: "Test Crew", mobile: "9000000001", designation: "Cleaning Executive" } });
    const other = await db.staff.create({ data: { employeeCode: "T-OT", name: "Other Crew", mobile: "9000000002", designation: "Cleaning Executive" } });
    const base = { customerName: "Test Customer", customerMobile: "9876501234", alternateMobile: "9876505678", address: "1 Test Rd", area: "Baner",
      service: "HOME_DEEP_CLEANING" as const, scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 6499, status: "ASSIGNED" as const,
      notes: "SECRET-OFFICE-NOTE", serviceItems: JSON.stringify([{ name: "Sofa", qty: 1, price: 999 }]) };
    const mine = await db.job.create({ data: { ...base, jobNumber: "T-1", publicToken: "TOKEN-MINE-123", assignments: { create: { staffId: me.id, isLead: true } } } });
    const theirs = await db.job.create({ data: { ...base, jobNumber: "T-2", publicToken: "TOKEN-OTHER-456", assignments: { create: { staffId: other.id } } } });
    await db.payment.create({ data: { invoiceNumber: "T-INV-1", clientName: "Test Customer", amount: 6499, paidAmount: 2000, dueDate: new Date(), jobId: mine.id } });

    const job = await getMyJob(me.id, mine.id);
    assert.ok(job, "own assigned job is visible");
    assert.deepEqual(job.collect, { balanceDue: 4499 });
    const day = await getMyDay(me.id, new Date());
    assert.equal(day.jobs.length, 1, "day view lists only my job");
    assert.deepEqual(day.jobs[0].collect, { balanceDue: 4499 });
    for (const [label, payload] of [["job detail", job], ["day view", day.jobs]] as const) {
      const json = JSON.stringify(payload);
      for (const leak of ["9876501234", "9876505678", "TOKEN-MINE-123", "SECRET-OFFICE-NOTE", "6499", "2000", "999", "/booking/"]) {
        assert.ok(!json.includes(leak), `${label} leaks ${leak}`);
      }
      for (const key of ["jobValue", "jobAmount", "payments", "payment", "paid", "customerMobile", "alternateMobile", "publicToken", "notes", "serviceItems"]) {
        assert.ok(!new RegExp(`"${key}":`).test(json), `${label} exposes key ${key}`);
      }
    }
    assert.equal(await getMyJob(me.id, theirs.id), null, "a job assigned to someone else is denied");

    // Numbering never reuses an issued number (row-count numbering collided after a
    // deletion or when Payments and standalone Invoices share the INV sequence).
    const { generateInvoiceNumber, generateStandaloneInvoiceNumber, generateLeadNumber } = await import("../src/lib/id-generators");
    const yr = new Date().getFullYear();
    // A standalone invoice numbered ahead of the Payment count (count-based numbering re-issued it).
    await db.invoice.create({ data: { invoiceNumber: `INV-${yr}-0007`, customerName: "T", lineItems: "[]", subTotal: 1, totalAmount: 1 } });
    const inv = await generateInvoiceNumber();
    const standalone = await generateStandaloneInvoiceNumber();
    assert.equal(inv, `INV-${yr}-0008`, "payment invoice number skips past issued numbers");
    assert.equal(standalone, `INV-${yr}-0008`);
    await db.lead.create({ data: { leadNumber: `LD-${yr}-0050`, name: "T", mobile: "9000000003", area: "x", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } });
    assert.equal(await generateLeadNumber(), `LD-${yr}-0051`, "lead number never collides with an existing one");

    // ── No ₹3,999 minimum (owner decision 2026-10-10): real public bookings below ₹3,999 go through
    // at their exact pricing-master totals; the other validation rules still hold.
    const { publicBookLead } = await import("../src/server/actions/public-booking");
    const book = async (v: Record<string, unknown>) => {
      try { return (await publicBookLead(v)) as { error?: string } | undefined; } catch (e) {
        // revalidatePath() needs a Next request context; it runs after every DB write, so ignore it here.
        if (/static generation store missing/i.test(String((e as Error).message))) return undefined;
        throw e;
      }
    };
    const bookDay = new Date(Date.now() + 5.5 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
    const bookBase = { name: "Small Job Test", area: "Baner", address: "1 Test Rd", timeSlot: "", attribution: {} };
    const small: [string, string, { contentId: string; qty: number }[], number][] = [
      ["9100000001", "INDIVIDUAL_CLEANING", [{ contentId: "SCS-30", qty: 1 }], 299], // 1 window
      ["9100000002", "INDIVIDUAL_CLEANING", [{ contentId: "SCS-09", qty: 5 }], 1245], // sofa 5 seats
      ["9100000003", "INDIVIDUAL_CLEANING", [{ contentId: "SCS-09", qty: 5 }, { contentId: "SCS-10", qty: 2 }], 2443], // sofa + 2 bathrooms
      ["9100000004", "COMBO_PACKAGE", [{ contentId: "SCS-26", qty: 1 }], 3499], // Kitchen + 2 Bathroom + Fridge
      ["9100000005", "COMBO_PACKAGE", [{ contentId: "SCS-27", qty: 1 }], 3999], // ₹3,999 still works
    ];
    for (const [mobile, cat, items, total] of small) {
      const r = await book({ ...bookBase, mobile, serviceCategory: cat, serviceDate: bookDay, selectedItems: items });
      assert.ok(!r?.error, `₹${total} booking rejected: ${r?.error}`);
      const lead = await db.lead.findFirst({ where: { mobile }, select: { quoteAmount: true } });
      assert.equal(lead?.quoteAmount, total, `stored ₹${lead?.quoteAmount}, expected the exact ₹${total} (never raised to a minimum)`);
    }
    // Below the item's own minimum quantity → priced at the minimum quantity (sofa 2 seats → 5 seats), not refused.
    await book({ ...bookBase, mobile: "9100000006", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: bookDay, selectedItems: [{ contentId: "SCS-09", qty: 2 }] });
    assert.equal((await db.lead.findFirst({ where: { mobile: "9100000006" }, select: { quoteAmount: true } }))?.quoteAmount, 1245);
    // Still enforced: past/invalid dates, invalid mobile, invalid quantities, unknown items, inspection-only.
    assert.match((await book({ ...bookBase, mobile: "9100000007", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: "2020-01-01", selectedItems: [{ contentId: "SCS-30", qty: 1 }] }))?.error ?? "", /future date/);
    assert.match((await book({ ...bookBase, mobile: "9100000007", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: "31-12-2030", selectedItems: [{ contentId: "SCS-30", qty: 1 }] }))?.error ?? "", /valid service date/);
    assert.match((await book({ ...bookBase, mobile: "12345", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: bookDay, selectedItems: [{ contentId: "SCS-30", qty: 1 }] }))?.error ?? "", /mobile/);
    assert.ok((await book({ ...bookBase, mobile: "9100000008", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: bookDay, selectedItems: [{ contentId: "SCS-30", qty: 0 }] }))?.error, "qty 0 refused");
    assert.ok((await book({ ...bookBase, mobile: "9100000008", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: bookDay, selectedItems: [{ contentId: "SCS-30", qty: 101 }] }))?.error, "qty > 100 refused");
    assert.match((await book({ ...bookBase, mobile: "9100000008", serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: bookDay, selectedItems: [{ contentId: "NOPE-1", qty: 1 }] }))?.error ?? "", /no longer available/);
    await book({ ...bookBase, mobile: "9100000009", serviceCategory: "HOME_DEEP_CLEANING", propertyType: "4 BHK", serviceDate: bookDay, selectedItems: [{ contentId: "SCS-04", qty: 1 }, { contentId: "SCS-30", qty: 1 }] });
    assert.equal((await db.lead.findFirst({ where: { mobile: "9100000009" }, select: { quoteAmount: true } }))?.quoteAmount, null, "inspection-only stays unpriced");
  } finally {
    // Always release the SQLite file first, so a failed assertion isn't hidden by EBUSY on cleanup.
    await (await import("../src/lib/db")).db.$disconnect().catch(() => {});
    if (prevUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prevUrl;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir — OS cleans it */ }
  }
});

test("job card team copy carries no customer phone, payment figures or office notes; office copy unchanged", () => {
  const props = { jobNumber: "J-1", logoDataUrl: null, customerName: "C", mobile: "9876501234", alternateMobile: "9876505678", address: "A", mapLink: null,
    date: "d", timeSlot: "t", service: "s", flatType: null, team: "Team 1", supervisor: "S", paymentStatus: "Partly Paid", jobValue: 6499, advance: 2000, balance: 4499,
    notes: "SECRET-OFFICE-NOTE" };
  const team = maskJobCardForAudience({ ...props, audience: "team" });
  const json = JSON.stringify(team);
  for (const leak of ["9876501234", "9876505678", "SECRET-OFFICE-NOTE", "6499", "2000", "4499", "Partly Paid"]) assert.ok(!json.includes(leak), `team copy leaks ${leak}`);
  assert.deepEqual(maskJobCardForAudience({ ...props, audience: "office" }), { ...props, audience: "office" });
});

test("review / photo messages never send a token-less /j/ link (privacy dead end)", () => {
  const withUrl = reviewRequestMessage({ customerName: "A", service: "Cleaning", googleReviewUrl: null, jobNumber: "JOB-1", bookingUrl: "https://x/booking/TOKEN" });
  assert.ok(withUrl.includes("https://x/booking/TOKEN"));
  const without = reviewRequestMessage({ customerName: "A", service: "Cleaning", googleReviewUrl: null, jobNumber: "JOB-1" });
  const premium = premiumReviewRequestMessage({ customerName: "A", service: "Cleaning", jobNumber: "JOB-1" });
  for (const m of [withUrl, without, premium]) assert.ok(!/\/j\/JOB-1(?!\?t=)/.test(m), m);
});

test("no ₹3,999 minimum in CRM: office-entered small amounts validate, and quotation/payment maths stay exact", () => {
  for (const amt of [499, 1599, 3200, 3999, 8499]) {
    assert.ok(leadSchema.safeParse({ name: "Test", mobile: "9100000010", area: "Baner", service: "HOUSEKEEPING", source: "CALL", quoteAmount: amt }).success, `lead ₹${amt}`);
    assert.ok(jobSchema.partial().safeParse({ jobValue: amt }).success, `job ₹${amt}`);
  }
  assert.ok(!jobSchema.partial().safeParse({ jobValue: -1 }).success, "negative job value still refused");
  // Small package: exact total, no top-up to a minimum.
  const t = packageTotals({ lines: [{ id: "a", group: "CUSTOMISED", contentId: "SCS-09", name: "Sofa Cleaning", unit: "per seat", qty: 5, unitPrice: 249 }], discount: 0 } as never);
  assert.equal(t.final, 1245);
  // Small job payments: advance / balance / status exact.
  assert.deepEqual(jobPaymentSummary(1599, [{ paidAmount: 500 }]), { paid: 500, balance: 1099, status: "Partly Paid" });
  assert.deepEqual(jobPaymentSummary(499, [{ paidAmount: 499 }]), { paid: 499, balance: 0, status: "Paid" });
  // No CRM UI or rule text still claims a ₹3,999 minimum.
  const calc = readFileSync(path.join(__dirname, "../src/components/shared/package-calculator.tsx"), "utf8");
  assert.ok(!/3,?999 minimum/i.test(calc));
});

test("staff collection helper returns only the balance due, never below zero", () => {
  assert.deepEqual(staffBalanceToCollect(6499, [{ paidAmount: 2000 }, { paidAmount: null }]), { balanceDue: 4499 });
  assert.deepEqual(staffBalanceToCollect(5000, [{ paidAmount: 6000 }]), { balanceDue: 0 });
  assert.deepEqual(Object.keys(staffBalanceToCollect(1, [])), ["balanceDue"]);
});

test("compact CRM service lines: full home = one line; small services = saved names × qty units; nothing invented", () => {
  assert.deepEqual(compactServiceLines({ service: "HOME_DEEP_CLEANING", packageName: "2 BHK Premium", serviceVariant: "2 BHK", scopeOfWork: "2 BHK Premium Home Deep Cleaning — full Premium room-by-room package scope (wall dry dusting …)" }), ["Full Home Cleaning — Premium"]);
  assert.deepEqual(compactServiceLines({ service: "HOME_DEEP_CLEANING", packageName: "3 BHK Platinum" }), ["Full Home Cleaning — Platinum"]);
  assert.deepEqual(compactServiceLines({ service: "HOME_DEEP_CLEANING", packageName: "2 BHK Platinum Unfurnished" }), ["Full Home Cleaning — Unfurnished"]);
  assert.deepEqual(compactServiceLines({ service: "HOME_DEEP_CLEANING", packageName: "Unfurnished", serviceVariant: "2 BHK" }), ["Full Home Cleaning — Unfurnished"]);
  assert.deepEqual(compactServiceLines({ service: "HOME_DEEP_CLEANING" }), [], "no package saved → nothing invented");
  const items = JSON.stringify([{ name: "Sofa Cleaning", qty: 5, unit: "per seat", unitPrice: 249 }, { name: "Bathroom Deep Cleaning", qty: 2, unit: "per bathroom", unitPrice: 599 }, { name: "Kitchen Deep Cleaning", qty: 1, unit: "per kitchen" }]);
  const small = compactServiceLines({ service: "HOUSEKEEPING", serviceItems: items, comboServices: JSON.stringify(["Kitchen + 2 Bathroom + Fridge"]) });
  assert.deepEqual(small, ["Sofa Cleaning × 5 seats", "Bathroom Deep Cleaning × 2 bathrooms", "Kitchen Deep Cleaning × 1 kitchen", "Combo Package — Kitchen + 2 Bathroom + Fridge × 1"]);
  assert.ok(!small.join(" ").includes("249"), "no prices in the compact lines");
  // Old record: scope snapshot bullets reused; empty record → nothing invented.
  assert.deepEqual(compactServiceLines({ service: "HOUSEKEEPING", scopeOfWork: "• Sofa Cleaning × 5 (per seat)\n• Window Cleaning" }), ["Sofa Cleaning × 5 (per seat)", "Window Cleaning"]);
  assert.deepEqual(compactServiceLines({ service: "PEST_CONTROL" }), []);
  assert.ok(isAutoScope("• Sofa Cleaning × 5") && isAutoScope(null) && !isAutoScope("Customer has a pet dog — keep gate closed"));
});

test("job card team copy keeps crew instructions but hides any phone number in them", () => {
  const base = { jobNumber: "J", logoDataUrl: null, customerName: "C", mobile: "9876501234", alternateMobile: null, address: "A", mapLink: null, date: "d", timeSlot: "t", service: "s", flatType: null, team: "T", supervisor: "S", paymentStatus: "Paid", jobValue: 1, advance: 1, balance: 0, notes: null, services: ["Sofa Cleaning × 5 seats"], instructions: "Call watchman 98765 01234 at the gate; pet dog" };
  const team = maskJobCardForAudience({ ...base, audience: "team" });
  assert.ok(team.instructions?.includes("pet dog") && !/98765\s?01234/.test(team.instructions ?? ""));
  assert.deepEqual(team.services, ["Sofa Cleaning × 5 seats"]);
  assert.equal(maskJobCardForAudience({ ...base, audience: "office" }).instructions, base.instructions);
});

test("customer quotation: compact home / small / combo rows, advance + balance, concise scope & terms", async () => {
  const React = (await import("react")).default;
  (globalThis as unknown as { React: unknown }).React = React; // components compile with the classic JSX runtime here
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CustomerDocument, COMPACT_TERMS } = await import("../src/components/public/customer-document");
  const company = { name: "Sahara", phone: "1", email: "e", address: "a", website: null, logoUrl: null, upiId: "sahara@upi", upiQrUrl: null, bankName: null, bankAccountName: null, bankAccountNumber: null, bankIfsc: null };
  const job = { jobNumber: "JOB-1", customerName: "Test", customerMobile: "9000000000", address: "1 Rd", area: "Baner", serviceLabel: "Home Deep Cleaning", packageName: null as string | null, serviceVariant: null as string | null, included: [] as string[], serviceItems: null as string | null, discountAmount: null, jobValue: 0, scopeOfWork: null as string | null, scheduledDate: new Date("2026-10-20T00:00:00+05:30"), scheduledTime: "10:00 AM", createdAt: new Date("2026-10-10T00:00:00+05:30"), completedAt: null, festivalName: null as string | null, paid: 0, invoiceNumber: null };
  const text = (j: typeof job, kind: "QUOTATION" | "INVOICE" = "QUOTATION") =>
    renderToStaticMarkup(CustomerDocument({ kind, job: j, company, shareUrl: "https://x/booking/quotation/T" })).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

  // Full home: one concise label + one scope line; never the room-by-room checklist.
  const home = text({ ...job, packageName: "2 BHK Premium", serviceVariant: "2 BHK", jobValue: 5499, paid: 2000, festivalName: "Navratri", scopeOfWork: "2 BHK Premium Home Deep Cleaning — full Premium room-by-room package scope (wall dry dusting + ceiling dry dusting)." });
  assert.ok(home.includes("Full Home Cleaning — Premium") && home.includes("2 BHK"));
  assert.ok(!/room-by-room|Living room & bedrooms:|Kitchen:/.test(home), "no room checklist in the quotation");
  assert.ok(/Final Payable ₹5,499/.test(home) && /Advance Paid ₹2,000/.test(home) && /Balance Due ₹3,499/.test(home));
  assert.ok(home.includes("Reschedule, postpone or cancel") && COMPACT_TERMS.every((t) => home.includes(t)) && COMPACT_TERMS.length <= 5);
  assert.ok(text({ ...job, packageName: "Unfurnished", serviceVariant: "2 BHK", jobValue: 4999 }).includes("Full Home Cleaning — Unfurnished"));

  // Small services: actual saved names, quantities and units; exact totals.
  const items = JSON.stringify([{ id: "a", group: "CUSTOMISED", contentId: "SCS-09", name: "Sofa Cleaning", unit: "per seat", qty: 5, unitPrice: 249 }, { id: "b", group: "CUSTOMISED", contentId: "SCS-10", name: "Bathroom Deep Cleaning", unit: "per bathroom", qty: 2, unitPrice: 599 }]);
  const small = text({ ...job, serviceLabel: "Housekeeping", serviceItems: items, jobValue: 2443, paid: 0 });
  assert.ok(small.includes("Sofa Cleaning") && small.includes("× 5 seats") && small.includes("× 2 bathrooms"));
  assert.ok(/Final Payable ₹2,443/.test(small) && /Balance Due ₹2,443/.test(small) && !small.includes("Scope of Work"));

  // Combo: package name + its price-master components.
  const combo = text({ ...job, serviceLabel: "Housekeeping", included: ["Kitchen + 2 Bathroom + Fridge"], jobValue: 3499, paid: 3499 });
  assert.ok(combo.includes("Combo Package — Kitchen + 2 Bathroom + Fridge") && /Empty kitchen · 2 bathrooms · fridge/.test(combo));
  assert.ok(/Balance Due ₹0/.test(combo));
  // Invoice keeps Received / Balance.
  assert.ok(/Received ₹3,499/.test(text({ ...job, included: ["Kitchen + 2 Bathroom + Fridge"], jobValue: 3499, paid: 3499 }, "INVOICE")));
});

test("office quotation/invoice PDF scope is concise for full-home packages; items keep their rules", () => {
  const home = documentScope({ service: "HOME_DEEP_CLEANING", packageName: "3 BHK Platinum", serviceVariant: "3 BHK" });
  assert.equal(home.notes.length, 1);
  assert.ok(home.notes[0].startsWith("Full Home Cleaning — Platinum:") && home.notes[0].includes("wall wet cleaning"));
  assert.ok(!/Living room & bedrooms:|Bathrooms:/.test(home.notes.join(" ")));
  const items = JSON.stringify([{ id: "a", group: "CUSTOMISED", contentId: "SCS-09", name: "Sofa Cleaning", unit: "per seat", qty: 5, unitPrice: 249 }]);
  assert.ok(documentScope({ service: "HOUSEKEEPING", serviceItems: items }).notes.some((n) => n.includes("Sofa Cleaning × 5") && n.includes("Minimum 5 seats")));
  // A staff-typed scope is kept as written.
  assert.deepEqual(documentScope({ service: "HOME_DEEP_CLEANING", packageName: "2 BHK Premium", scopeOfWork: "Only 2 bedrooms + kitchen, customer request" }).notes, ["Only 2 bedrooms + kitchen, customer request"]);
});

test("WhatsApp confirmation + share texts: concise, links, totals, MORE; no phone number in the confirmation", () => {
  const msg = premiumBookingConfirmationMessage({ customerName: "Asha", jobNumber: "JOB-2026-0300", service: "Home Deep Cleaning", date: new Date("2026-10-20T00:00:00+05:30"), timeSlot: "10:00 AM", address: "1 Rd, Baner", area: "Baner", balanceDue: 3499, bookingUrl: "https://b/booking/TOKEN", serviceSummary: "Full Home Cleaning — Premium", total: 5499, paid: 2000 });
  for (const s of ["JOB-2026-0300", "Full Home Cleaning — Premium", "10:00 AM", "Total ₹5,499 · Paid ₹2,000 · Balance ₹3,499", "https://b/booking/TOKEN", "https://b/booking/quotation/TOKEN", "?pay=advance", "MORE"]) assert.ok(msg.includes(s), s);
  assert.ok(msg.split("\n").length <= 14, "fits on one phone screen");
  assert.ok(!/\b\d{10}\b/.test(msg), "no visible phone number");
  const paidUp = premiumBookingConfirmationMessage({ customerName: "A", jobNumber: "J", service: "S", date: new Date(), timeSlot: "t", area: "x", balanceDue: 0, bookingUrl: "https://b/booking/T", total: 1245, paid: 1245 });
  assert.ok(paidUp.includes("fully settled") && !paidUp.includes("?pay=advance"));
  const share = documentShareMessage({ customerName: "Asha", label: "quotation", reference: "QT-2026-0007", url: "https://b/booking?quote=X", serviceSummary: "Sofa Cleaning × 5 seats", total: 1245 });
  assert.ok(share.includes("QT-2026-0007") && share.includes("Sofa Cleaning × 5 seats") && share.includes("₹1,245") && share.includes("https://b/booking?quote=X") && share.split("\n").length <= 6);
});

test("office quotation PDF stays Super Admin / Accounts only", () => {
  const src = readFileSync(path.join(__dirname, "../src/app/api/quotations/[id]/pdf/route.ts"), "utf8");
  assert.match(src, /\["ADMIN", "ACCOUNTS"\]\.includes\(session\.role\)/);
  assert.match(src, /if \(!session\) return new NextResponse\("Unauthorized", \{ status: 401 \}\)/);
});

test("festival landing (/offers) layout never hard-codes prices or a ₹3,999 minimum; claims come from Settings", () => {
  for (const f of ["../src/components/public/offers-tabs.tsx", "../src/app/offers/page.tsx"]) {
    const src = readFileSync(path.join(__dirname, f), "utf8");
    assert.ok(!/[₹]\s?\d|\b(4999|5499|6499|6999|8499|3999)\b/.test(src), `${f} must take prices from the pricing master`);
  }
  const kit = readFileSync(path.join(__dirname, "../src/components/public/landing-kit.tsx"), "utf8");
  assert.ok(!/4\.9\/5|1,?800\+/.test(kit), "rating / review count only from CRM Settings");
});

test("Google review badge text comes from Settings and never doubles the label", () => {
  assert.equal(reviewCountLabel("1800+"), "1,800+");
  assert.equal(reviewCountLabel("1,800+"), "1,800+");
  assert.equal(reviewCountLabel("1,800+ Google Reviews"), "1,800+");
  assert.equal(reviewCountLabel(""), "");
  assert.equal(reviewCountLabel(null), "");
});

test("WhatsApp booking template v3 follows Meta rules: ≤2 URL buttons, ≤25-char labels, review as quick reply", async () => {
  const { templateByName } = await import("../src/lib/whatsapp-cloud-templates");
  const t = templateByName("sahara_booking_confirmed_v3");
  assert.ok(t, "v3 template defined");
  const urls = t!.buttons!.filter((b) => b.type === "URL");
  assert.ok(urls.length <= 2, "Meta allows at most 2 URL buttons");
  assert.ok(t!.buttons!.every((b) => b.text.length <= 25), "button text ≤ 25 characters");
  assert.deepEqual(t!.buttons!.map((b) => b.text), ["View Quotation", "Pay Now / Later", "Google Review"]);
  assert.ok(urls.every((b) => /\/booking\/(quotation|pay)\/\{\{1\}\}$/.test(b.url ?? "")), "plain-token path URLs");
  const { WHATSAPP_TEST_MODE_NUMBERS } = await import("../src/lib/whatsapp");
  assert.ok(!WHATSAPP_TEST_MODE_NUMBERS.includes("917083347130"), "protected main number is never an API test/send target");
});

test("Lead Source Breakdown buckets: Google Ads / Meta Ads / WhatsApp Broadcast / Organic; unknown stays unknown", async () => {
  const { leadSourceBucket } = await import("../src/lib/attribution");
  assert.equal(leadSourceBucket("Google Ads"), "Google Ads");
  assert.equal(leadSourceBucket("Meta Ads"), "Meta Ads");
  assert.equal(leadSourceBucket("WhatsApp Marketing"), "WhatsApp Broadcast");
  for (const c of ["Google Organic/SEO", "Google Business Profile", "Instagram Organic", "Facebook Organic", "Website Direct"]) assert.equal(leadSourceBucket(c), "Organic", c);
  for (const c of [null, undefined, "", "Unattributed", "Other"]) assert.equal(leadSourceBucket(c), "Unknown / not tracked", String(c));
});

test("WhatsApp broadcast: 50–100/min pacing, 5,000 cap, live sends only to recorded opt-ins and stays switched off by default", async () => {
  const b = await import("../src/server/whatsapp-broadcast");
  assert.equal(b.BROADCAST_MIN_PER_MINUTE, 50);
  assert.equal(b.BROADCAST_MAX_PER_MINUTE, 100);
  assert.equal(b.BROADCAST_MAX_RECIPIENTS, 5000);
  const src = readFileSync(path.join(__dirname, "../src/server/actions/whatsapp-campaigns.ts"), "utf8");
  const start = src.slice(src.indexOf("export async function startBroadcast"));
  assert.match(start, /requireAdmin\(\)/, "Admin only");
  assert.match(start, /process\.env\.WHATSAPP_CAMPAIGNS !== "on"/, "live gated by WHATSAPP_CAMPAIGNS");
  assert.match(start, /classifyContacts\(contacts\)\)\.ok/, "live recipients = uploaded ∩ recorded opt-in (no STOP)");
  assert.match(start, /WHATSAPP_TEST_NUMBERS/, "test mode uses QA numbers only");
  const job = readFileSync(path.join(__dirname, "../src/server/whatsapp-broadcast.ts"), "utf8");
  assert.match(job, /isOptedOut\(to\)/, "each send re-checks STOP");
});

test("Category landing pages: public, tracked, no hard-coded prices, attribution + Meta events wired", () => {
  const root = path.join(__dirname, "..");
  const pages = ["residential-cleaning", "commercial-cleaning", "painting-services", "pest-control", "housekeeping-services"];
  const mw = readFileSync(path.join(root, "src/middleware.ts"), "utf8");
  for (const p of pages) {
    assert.ok(mw.includes(`"/${p}"`), `${p} is a public path in middleware`);
    const src = readFileSync(path.join(root, `src/app/${p}/page.tsx`), "utf8");
    assert.match(src, /LandingShell/, `${p} renders in LandingShell (AttributionCapture + Meta Pixel)`);
    assert.match(src, /StickyWhatsApp/, `${p} has the sticky WhatsApp CTA`);
    assert.doesNotMatch(src, /₹\s?\d/, `${p} must not hard-code a price`);
  }
  const shell = readFileSync(path.join(root, "src/components/public/landing-kit.tsx"), "utf8");
  assert.match(shell, /<AttributionCapture \/>/);
  assert.match(shell, /<MarketingTags withPixel \/>/);
  const form = readFileSync(path.join(root, "src/components/public/category-lead-form.tsx"), "utf8");
  assert.match(form, /getAttributionPayload\(\)/, "lead carries first/latest touch (utm, gclid, fbclid)");
  assert.match(form, /trackLead\(/);
  assert.match(form, /trackSchedule\(/);
  const tags = readFileSync(path.join(root, "src/components/public/marketing-tags.tsx"), "utf8");
  assert.match(tags, /"track", "Schedule"/);
  assert.match(tags, /"track", "Contact"/);
  assert.match(tags, /"track", "Lead"/);
});
