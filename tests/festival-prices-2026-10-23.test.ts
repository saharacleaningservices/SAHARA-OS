// Owner festival package prices (2026-10-23) loaded through the one-time pricing migration. Run: npm run test:festival
// Throwaway SQLite DB built with scripts/db-setup.mjs; the migration is re-run against rows the test sets up.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PRICING_MASTER } from "../src/lib/pricing-master";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-festival-"));
const dbFile = path.join(dir, "test.db");
const setup = () => execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
test.after(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10) + "T00:00:00.000+00:00";
const MARKER = "_migration:owner-festival-prices-2026-10-23";
const OFFER_SQL = `INSERT INTO "FestivalOffer" ("id","name","startDate","endDate","isActive","updatedByName","createdAt","updatedAt") VALUES (?,?,?,?,1,'t',?,?)`;
const PRICE_SQL = `INSERT INTO "FestivalPrice" ("id","festivalId","contentId","price") VALUES (?,?,?,?)`;

test("migration: the six festival package prices are set in running and upcoming windows only; ended windows and regular prices untouched; runs once", () => {
  setup(); // fresh DB: schema + the seeded festival offers
  const db = new Database(dbFile);
  db.prepare("DELETE FROM FestivalPrice").run();
  db.prepare("DELETE FROM FestivalOffer").run();
  db.prepare("DELETE FROM PriceSetting WHERE contentId = ?").run(MARKER);
  const offer = db.prepare(OFFER_SQL);
  const price = db.prepare(PRICE_SQL);
  const now = new Date().toISOString();
  offer.run("f_ended", "Ended", day(-30), day(-10), now, now);
  offer.run("f_running", "Running", day(-2), day(3), now, now);
  offer.run("f_upcoming", "Upcoming", day(5), day(20), now, now);
  const old: Record<string, number> = { "SCS-01": 4999, "SCS-02": 5499, "SCS-03": 6999, "SCS-05": 6499, "SCS-06": 6999, "SCS-07": 8499 };
  for (const f of ["f_ended", "f_running", "f_upcoming"]) for (const [c, v] of Object.entries(old)) price.run(`${f}_${c}`, f, c, v);
  db.close();

  setup();
  const read = () => {
    const d = new Database(dbFile);
    const rows = d.prepare(`SELECT "festivalId" AS f, "contentId" AS c, "price" AS p FROM "FestivalPrice"`).all() as { f: string; c: string; p: number }[];
    d.close();
    return (f: string, c: string) => rows.find((r) => r.f === f && r.c === c)!.p;
  };
  const p = read();
  // 1 BHK Premium 5,499 · Platinum 6,499 · 2 BHK Premium 6,499 · Platinum 7,499 · 3 BHK Premium 7,499 · Platinum 8,999
  const want: Record<string, number> = { "SCS-01": 5499, "SCS-05": 6499, "SCS-02": 6499, "SCS-06": 7499, "SCS-03": 7499, "SCS-07": 8999 };
  for (const f of ["f_running", "f_upcoming"]) for (const [c, v] of Object.entries(want)) assert.equal(p(f, c), v, `${f} ${c}`);
  for (const [c, v] of Object.entries(old)) assert.equal(p("f_ended", c), v, `an ended window keeps ${c}`);
  // Regular prices live in the code master; the migration does not touch them.
  assert.deepEqual(["SCS-01", "SCS-02", "SCS-03", "SCS-05", "SCS-06", "SCS-07"].map((id) => PRICING_MASTER.find((x) => x.contentId === id)!.price), [4499, 5499, 6999, 5499, 6499, 7999]);

  // One time only: a Super Admin change afterwards is never reset by a restart.
  const d = new Database(dbFile);
  d.prepare(`UPDATE "FestivalPrice" SET "price" = 5999 WHERE "festivalId" = 'f_running' AND "contentId" = 'SCS-01'`).run();
  assert.equal((d.prepare(`SELECT COUNT(*) AS n FROM "PriceSetting" WHERE "contentId" = ?`).get(MARKER) as { n: number }).n, 1);
  d.close();
  setup();
  assert.equal(read()("f_running", "SCS-01"), 5999);
});
