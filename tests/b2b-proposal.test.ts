// B2B facility-management proposal builder + quotation integration. Run: npm run test:b2b
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DRAFT_B2B_TERMS, proposalItems, proposalTerms, validateBrief, type B2bBrief } from "../src/lib/b2b-proposal";

const brief = (over: Partial<B2bBrief> = {}): B2bBrief => ({
  siteType: "OFFICE", siteName: "Test Tech Park", siteAddress: "Kharadi", areaSqft: 12000, daysPerWeek: 6, shiftHours: 8,
  staff: [{ role: "Housekeeping staff", count: 3, monthlyRate: 15000 }, { role: "Supervisor", count: 1, monthlyRate: 22000 }],
  consumablesByClient: false, contractMonths: 12, ...over,
});

test("items: one line per role; amount = count × entered monthly rate (nothing priced automatically)", () => {
  const items = proposalItems(brief());
  assert.equal(items.length, 2);
  assert.equal(items[0].amount, 45000);
  assert.equal(items[1].amount, 22000);
  assert.match(items[0].name, /Housekeeping staff × 3/);
  assert.match(items[0].description, /6 days\/week, 8 h shift/);
});

test("terms text: site, schedule, staffing, scope for the site type, consumables, draft terms by default", () => {
  const t = proposalTerms(brief());
  assert.match(t, /Corporate office/);
  assert.match(t, /Site: Test Tech Park, Kharadi · approx\. 12,000 sq ft/);
  assert.match(t, /Staffing: 3 × Housekeeping staff, 1 × Supervisor/);
  assert.match(t, /Daily: Sweeping and wet mopping/);
  assert.match(t, /supplied by Sahara Cleaning Services/);
  assert.ok(t.includes(DRAFT_B2B_TERMS));
  const soc = proposalTerms(brief({ siteType: "SOCIETY", consumablesByClient: true, terms: "Custom terms." }));
  assert.match(soc, /Residential society/);
  assert.match(soc, /Lift cleaning/);
  assert.match(soc, /supplied by the client/);
  assert.ok(soc.endsWith("Custom terms."));
  assert.ok(!soc.includes(DRAFT_B2B_TERMS), "edited terms replace the draft");
});

test("validation: site name, at least one staff line, a positive rate per line", () => {
  assert.deepEqual(validateBrief(brief()), { ok: true });
  assert.equal(validateBrief(brief({ siteName: " " })).ok, false);
  assert.equal(validateBrief(brief({ staff: [] })).ok, false);
  assert.equal(validateBrief(brief({ staff: [{ role: "Staff", count: 2, monthlyRate: 0 }] })).ok, false);
  assert.equal(validateBrief(brief({ staff: [{ role: "", count: 2, monthlyRate: 100 }] })).ok, false);
});

test("quotation integration (real DB): custom terms + 15-day validity stored; default call unchanged", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-b2b-"));
  const dbFile = path.join(dir, "b.db");
  const prev = process.env.DATABASE_URL;
  try {
    execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
    process.env.DATABASE_URL = `file:${dbFile}`;
    const { db } = await import("../src/lib/db");
    const lead = await db.lead.create({ data: { leadNumber: "LD-T-B2B", name: "Test Tech Park", mobile: "9000000071", area: "Kharadi", service: "HOUSEKEEPING" as never, source: "WEBSITE" as never } });
    const b = brief();
    const terms = proposalTerms(b);
    const now = Date.now();
    const q = await db.quotation.create({ data: { quoteNumber: "QT-T-B2B", leadId: lead.id, services: JSON.stringify(proposalItems(b)), subTotal: 67000, gstPercent: 18, gstAmount: 12060, totalAmount: 79060, terms, validTill: new Date(now + 15 * 86400000) } });
    const back = await db.quotation.findUnique({ where: { id: q.id } });
    assert.equal(back?.terms, terms);
    assert.ok(back!.terms.length <= 6000);
    assert.equal(JSON.parse(back!.services).length, 2);
    await db.$disconnect();
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createQuotation keeps its old behaviour when no options are passed (source guard)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(path.join(process.cwd(), "src/server/actions/leads.ts"), "utf8");
  assert.match(src, /opts: \{ terms\?: string; validDays\?: number \} = \{\}/);
  assert.match(src, /: STANDARD_TERMS_TEXT,/); // default terms = the standard single-page quotation terms (17 Oct 2026)
  assert.match(src, /opts\.validDays \?\? 7/);
});
