import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

// Guards the production boot path (2026-11-06): a db-setup crash puts the Coolify container in a restart loop and
// every deploy fails its healthcheck, so CI runs the real script on a scratch database, first boot and re-boot.
const script = path.resolve(__dirname, "..", "scripts", "db-setup.mjs");

test("db-setup never touches the main connection after db.close()", () => {
  const src = readFileSync(script, "utf8");
  const closeAt = src.indexOf("\ndb.close();");
  assert.ok(closeAt > 0, "main connection close not found");
  const after = src.slice(closeAt + "\ndb.close();".length);
  const offenders = after.split("\n").filter((l) => /(^|[^A-Za-z0-9_.])db\.(exec|prepare|pragma|transaction)\(/.test(l));
  assert.deepEqual(offenders, []);
});

test("db-setup runs clean on a fresh database and again on an existing one", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-db-setup-"));
  const dbFile = path.join(dir, "boot.db");
  try {
    for (const pass of ["fresh", "re-boot"]) {
      const r = spawnSync(process.execPath, [script], {
        env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(r.status, 0, `${pass} boot failed:\n${(r.stderr || "").slice(-2000)}`);
    }
    const db = new Database(dbFile, { readonly: true });
    const t = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='MybillbookReviewItem'`).get();
    const cols = (db.prepare(`PRAGMA table_info("Customer")`).all() as { name: string }[]).map((c) => c.name);
    db.close();
    assert.ok(t, "MybillbookReviewItem table missing");
    assert.ok(cols.includes("segment") && cols.includes("gstin"), "Customer.segment/gstin missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
