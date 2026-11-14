import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

test("db-setup adds zone/GPS/OTP schema, is idempotent, and keeps existing rows", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-mig-"));
  const dbFile = path.join(dir, "t.db");
  const run = () => spawnSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, encoding: "utf8" });
  try {
    assert.equal(run().status, 0);
    const db = new Database(dbFile);
    db.pragma("foreign_keys = OFF");
    db.prepare(`INSERT INTO "Lead" ("id","leadNumber","name","mobile","area","service","source","stage","updatedAt") VALUES ('l1','L-1','Asha','9999999999','Kharadi','HOME_DEEP_CLEANING','WEBSITE','NEW',CURRENT_TIMESTAMP)`).run();
    db.close();

    const second = run();
    assert.equal(second.status, 0, second.stderr);

    const check = new Database(dbFile, { readonly: true });
    const cols = (t: string) => check.prepare(`PRAGMA table_info("${t}")`).all().map((c) => (c as { name: string }).name);
    for (const c of ["zone", "pincode", "utmSource", "utmMedium", "utmCampaign", "gclid", "fbclid"]) assert.ok(cols("Lead").includes(c), `Lead.${c}`);
    for (const c of ["checkOutLat", "checkOutLng"]) assert.ok(cols("Attendance").includes(c), `Attendance.${c}`);
    for (const c of ["startLat", "startLng", "completeLat", "completeLng"]) assert.ok(cols("Job").includes(c), `Job.${c}`);
    for (const t of ["StaffLocationPing", "JobOtp", "LoginOtp"]) assert.ok(cols(t).length > 0, t);
    const row = check.prepare(`SELECT name, zone FROM "Lead" WHERE id='l1'`).get() as { name: string; zone: string | null };
    assert.equal(row.name, "Asha");
    assert.equal(row.zone, null);
    check.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
