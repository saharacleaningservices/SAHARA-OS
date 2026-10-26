// Seasonal pricing rules (owner request 2026-10-23): a +/- percentage window on top of regular prices, Super Admin only.
// Run: npx tsx --test tests/seasonal-pricing.test.ts   Throwaway DB; no network.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PRICING_MASTER, activeCampaign, campaignFestivalNames, festivalForDate, seasonalPrice, unitPriceFor, upcomingFestivals, type FestivalWindow } from "../src/lib/pricing-master";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-seasonal-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};
let db: typeof import("../src/lib/db").db;
let act: typeof import("../src/server/actions/pricing");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/pricing");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const item = PRICING_MASTER.find((p) => p.price != null && p.contentId === "SCS-01")!;
const seasonal = (pct: number): FestivalWindow => ({ id: "s", name: "Peak season", start: "2026-12-20", end: "2027-01-05", prices: {}, kind: "SEASONAL", adjustPercent: pct });

test("pure: a seasonal % applies to regular prices, an explicit festival price still wins, and a seasonal window is never a festival campaign", () => {
  assert.equal(seasonalPrice(5499, 10), 6049);
  assert.equal(seasonalPrice(5499, -10), 4949);
  assert.equal(seasonalPrice(1, -50), 1);
  assert.equal(unitPriceFor(item, seasonal(10)), seasonalPrice(item.price!, 10));
  assert.equal(unitPriceFor(item, null), item.price);
  assert.equal(unitPriceFor(item, { ...seasonal(10), prices: { [item.contentId]: 4000 } }), 4000);
  assert.equal(unitPriceFor(item, { ...seasonal(0) }), item.price);
  const inspection = PRICING_MASTER.find((p) => p.price == null)!;
  assert.equal(unitPriceFor(inspection, seasonal(10)), null, "unpriced / inspection-only items stay unpriced");
  const w = [seasonal(10)];
  assert.equal(festivalForDate(w, "2026-12-25")?.id, "s");
  assert.equal(activeCampaign(w, "2026-12-25"), null);
  assert.equal(campaignFestivalNames(w, "2026-12-25"), null);
  assert.deepEqual(upcomingFestivals(w, "2026-12-01"), []);
});

const base = { name: "Peak season", start: "2026-12-20", end: "2027-01-05", isActive: true, prices: {}, kind: "SEASONAL" as const, adjustPercent: 10 };

test("saving: only Super Admin; a percentage is required and bounded; overlapping active windows are refused; stored and audited", async () => {
  for (const role of ["ACCOUNTS", "OPERATIONS", "STAFF"]) {
    session = { sub: "u", name: "x", email: "x@x", role };
    assert.match(String((await act.saveFestivalOffer(base)).error), /Only Super Admin/, role);
  }
  session = { sub: "a", name: "Altaf Sheikh", email: "a@x", role: "ADMIN" };
  assert.match(String((await act.saveFestivalOffer({ ...base, adjustPercent: 0 })).error), /percentage/);
  assert.ok((await act.saveFestivalOffer({ ...base, adjustPercent: 80 })).error, "more than +/-50% is refused");
  const ok = await act.saveFestivalOffer({ ...base, prices: { "SCS-01": 1 } }); // per-item prices are ignored for a seasonal rule
  assert.equal(ok.ok, true);
  const row = await db.festivalOffer.findFirstOrThrow({ where: { name: "Peak season" }, include: { prices: true } });
  assert.deepEqual([row.kind, row.adjustPercent, row.prices.length], ["SEASONAL", 10, 0]);
  assert.match(String((await act.saveFestivalOffer({ ...base, name: "Other", start: "2027-01-01", end: "2027-01-10" })).error), /overlap/);
  const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Pricing", action: "FESTIVAL_CREATE" } });
  assert.match(audit.summary, /seasonal \+10%/);

  // The admin list returns the rule; an ordinary festival offer still saves with its own prices and no percentage.
  const admin = await act.getPricingAdminData();
  const mine = admin!.festivals.find((f) => f.name === "Peak season")!;
  assert.deepEqual([mine.kind, mine.adjustPercent], ["SEASONAL", 10]);
  assert.equal((await act.saveFestivalOffer({ name: "Holi", start: "2027-03-01", end: "2027-03-05", isActive: true, prices: { "SCS-01": 4000 }, kind: "OFFER", adjustPercent: 25 })).ok, true);
  const holi = await db.festivalOffer.findFirstOrThrow({ where: { name: "Holi" }, include: { prices: true } });
  assert.deepEqual([holi.kind, holi.adjustPercent, holi.prices.length], ["OFFER", 0, 1]);
});
