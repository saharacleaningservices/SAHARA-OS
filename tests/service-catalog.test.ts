// Service Catalog (owner 2026-10-22). Run: npm run test:catalog — throwaway SQLite DB, no network.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SERVICE_CATALOG_SEED, HIGH_RISE_CLAUSE, POST_INTERIOR_DISCLAIMER, VALUABLES_CLAUSE } from "../src/lib/service-catalog-seed";
import { canAccess } from "../src/lib/constants";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-catalog-"));
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
let cat: typeof import("../src/server/service-catalog");
let act: typeof import("../src/server/actions/service-catalog");

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  cat = await import("../src/server/service-catalog");
  act = await import("../src/server/actions/service-catalog");
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

test("the catalog covers every service in the owner's list, each with scope, equipment and terms", () => {
  const slugs = SERVICE_CATALOG_SEED.map((s) => s.slug);
  for (const want of ["full-home-premium", "full-home-platinum", "unfurnished-flat", "bathroom-cleaning", "kitchen-cleaning", "sofa-carpet-shampooing", "office-cleaning", "pest-control", "interior-painting"]) assert.ok(slugs.includes(want), want);
  for (const s of SERVICE_CATALOG_SEED) {
    assert.ok(s.scopeOfWork.length >= 2 && s.scopeOfWork.length <= 6, `${s.slug}: a few grouped scope bullets, not a long list`);
    assert.ok(s.scopeOfWork.every((x) => x.length <= 520), `${s.slug}: each bullet stays compact`);
    assert.equal(s.termsConditions.length, 5, `${s.slug}: exactly five core terms`);
    assert.ok(s.equipmentsUsed.length >= 3, `${s.slug}: equipment`);
    for (const clause of [VALUABLES_CLAUSE, HIGH_RISE_CLAUSE, POST_INTERIOR_DISCLAIMER]) assert.ok(s.termsConditions.includes(clause), `${s.slug}: required clause`);
    assert.ok(!/₹|\bRs\b|\bprice\b/i.test(s.scopeOfWork.join(" ")), `${s.slug}: no prices in the catalog`);
  }
});

test("Premium and Platinum differ exactly where the approved scope says they do (walls, chimney)", () => {
  const premium = SERVICE_CATALOG_SEED.find((s) => s.slug === "full-home-premium")!.scopeOfWork.join("\n");
  const platinum = SERVICE_CATALOG_SEED.find((s) => s.slug === "full-home-platinum")!.scopeOfWork.join("\n");
  assert.match(premium, /walls: dry dusting/);
  assert.match(platinum, /walls: wet cleaning/);
  assert.match(premium, /chimney: exterior cleaning/);
  assert.match(platinum, /chimney: full cleaning/);
});

test("a booking maps to its catalog entry by package, then by service", () => {
  const s = cat.catalogSlugForJob;
  assert.equal(s({ service: "HOME_DEEP_CLEANING", packageName: "Platinum" }), "full-home-platinum");
  assert.equal(s({ service: "HOME_DEEP_CLEANING", packageName: "Premium", serviceVariant: "2 BHK" }), "full-home-premium");
  assert.equal(s({ service: "HOME_DEEP_CLEANING", serviceVariant: "Unfurnished 2 BHK" }), "unfurnished-flat");
  assert.equal(s({ service: "PEST_CONTROL" }), "pest-control");
  assert.equal(s({ service: "INTERIOR_PAINTING" }), "interior-painting");
  assert.equal(s({ service: "COMMERCIAL_CLEANING" }), "office-cleaning");
  assert.equal(s({ service: "HOME_DEEP_CLEANING" }), null);
});

test("reads fall back to the defaults; only the Super Admin can save, and a save wins over the default", async () => {
  const before = (await cat.getServiceCatalog()).find((e) => e.slug === "pest-control")!;
  assert.deepEqual([before.stored, before.reviewed], [false, false]);
  const edit = { slug: "pest-control", scopeOfWork: "Line one\nLine two\nLine three", termsConditions: "Term one", equipmentsUsed: "Sprayer", reviewed: true };
  for (const role of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) {
    session = { sub: "u", name: role, email: "e@t", role };
    assert.equal((await act.saveCatalogEntry(edit)).success, false, role);
  }
  session = null;
  assert.equal((await act.saveCatalogEntry(edit)).success, false);
  assert.equal((await cat.getServiceCatalog()).find((e) => e.slug === "pest-control")!.stored, false, "denied calls saved nothing");
  session = { sub: "a", name: "Altaf", email: "a@t", role: "ADMIN" };
  assert.equal((await act.saveCatalogEntry(edit)).success, true);
  const after = (await cat.getServiceCatalog()).find((e) => e.slug === "pest-control")!;
  assert.deepEqual([after.stored, after.reviewed, after.scopeOfWork, after.updatedByName], [true, true, ["Line one", "Line two", "Line three"], "Altaf"]);
  assert.equal((await act.saveCatalogEntry({ ...edit, slug: "made-up" })).success, false, "unknown slug refused");
  assert.equal((await act.saveCatalogEntry({ ...edit, scopeOfWork: "  \n " })).success, false, "empty scope refused");
});

test("the Service Catalog menu is open to Admin, Accounts and Operations only", () => {
  assert.deepEqual(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"].map((r) => canAccess(r, "service-catalog")), [true, true, true, false, false]);
});
