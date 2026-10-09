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
import { livePkgs } from "../src/lib/marketing-content";
import { publicPaymentState, resolvePublicEstimate } from "../src/lib/booking-payment";
import { resolvePackageEstimate } from "../src/lib/lead-estimate";
import { redactJob, redactLead } from "../src/lib/redact";
import { readdirSync, readFileSync } from "node:fs";
import { draftQuotation } from "../src/lib/ai/quotation";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "../src/lib/whatsapp-keywords";
import { staffBalanceToCollect } from "../src/lib/payment-status";
import { reviewRequestMessage, premiumReviewRequestMessage } from "../src/lib/whatsapp-templates";
import { maskJobCardForAudience } from "../src/lib/pdf/job-card-mask";

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

test("staff collection helper returns only the balance due, never below zero", () => {
  assert.deepEqual(staffBalanceToCollect(6499, [{ paidAmount: 2000 }, { paidAmount: null }]), { balanceDue: 4499 });
  assert.deepEqual(staffBalanceToCollect(5000, [{ paidAmount: 6000 }]), { balanceDue: 0 });
  assert.deepEqual(Object.keys(staffBalanceToCollect(1, [])), ["balanceDue"]);
});
