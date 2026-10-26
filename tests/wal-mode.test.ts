// SQLite runs in WAL mode after boot-time setup, and the restore route cleans stale WAL files. Run: npx tsx --test tests/wal-mode.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

test("db-setup puts a fresh database into WAL mode and survives a second run", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-wal-"));
  const file = path.join(dir, "t.db");
  try {
    for (let i = 0; i < 2; i++) execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${file}` }, stdio: "ignore" });
    const d = new Database(file, { readonly: true });
    assert.equal(d.pragma("journal_mode", { simple: true }), "wal");
    assert.equal(d.pragma("integrity_check", { simple: true }), "ok");
    d.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("restore route checkpoints before the safety copy and removes stale -wal / -shm after the swap", () => {
  const src = readFileSync("src/app/api/backup/restore/route.ts", "utf8");
  assert.ok(src.includes("wal_checkpoint(TRUNCATE)"));
  assert.ok(src.includes('["-wal", "-shm"]') && src.includes("fs.rmSync(`${dbPath}${suffix}`"));
  assert.ok(src.indexOf("wal_checkpoint") < src.indexOf("copyFileSync(dbPath, safetyPath)"));
});

test("recover-from-backup.sh restores a backup archive, rejects a bad one, and leaves a WAL-ready database", { skip: process.platform === "win32" && !process.env.SAHARA_TEST_BASH }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sahara-rec-"));
  const posix = (p: string) => p.split(path.sep).join("/");
  try {
    const src = path.join(dir, "src.db");
    execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${src}` }, stdio: "ignore" });
    const d = new Database(src);
    d.prepare("INSERT INTO User (id, name, email, passwordHash, role, updatedAt) VALUES ('u1', 'T', 't@example.test', 'x', 'ADMIN', '2026-01-01')").run();
    mkdirSync(path.join(dir, "pk"));
    d.exec(`VACUUM INTO '${posix(path.join(dir, "pk", "dev.db"))}'`);
    d.close();
    execFileSync("tar", ["--force-local", "-czf", posix(path.join(dir, "b.tar.gz")), "-C", posix(path.join(dir, "pk")), "dev.db"]);
    const out = execFileSync("bash", ["scripts/recover-from-backup.sh", posix(path.join(dir, "b.tar.gz")), posix(path.join(dir, "new"))], { encoding: "utf8" });
    assert.match(out, /integrity: ok \| users: 1/);
    const r = new Database(path.join(dir, "new", "dev.db"), { readonly: true });
    assert.equal(r.pragma("journal_mode", { simple: true }), "wal");
    r.close();
    assert.throws(() => execFileSync("bash", ["scripts/recover-from-backup.sh", posix(path.join(dir, "missing.tar.gz"))], { stdio: "ignore" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
