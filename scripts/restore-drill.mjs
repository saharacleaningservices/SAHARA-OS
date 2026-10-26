// Sahara OS — isolated restore drill.
//
// Proves that a backup archive (as produced by GET /api/backup and stored in Google Drive → "Sahara OS Backups")
// can actually be restored with the CURRENT code — without ever touching production:
//
//   1. extracts the archive into a brand-new temporary folder,
//   2. checks dev.db with SQLite's integrity_check and counts the main tables (counts only — no customer data printed),
//   3. runs scripts/db-setup.mjs against a COPY of that database (the same migration production runs on boot),
//   4. re-checks integrity after the migration and reports the uploads folder,
//   5. deletes the temporary folder (pass --keep to keep it for inspection).
//
// Usage:  node scripts/restore-drill.mjs <path/to/sahara-os-YYYYMMDD-HHMMSS.tar.gz> [--keep]
//    or:  npm run restore:drill -- <archive> [--keep]
// Exit code 0 = restorable; anything else = do NOT rely on this backup.
//
// Safety: refuses to run inside the production container (/app/data present) and never reads DATABASE_URL.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
const archive = args.find((a) => !a.startsWith("--"));

function fail(msg) {
  console.error(`RESTORE DRILL FAILED — ${msg}`);
  process.exit(1);
}

if (!archive) fail("pass the backup archive path (.tar.gz)");
if (!fs.existsSync(archive)) fail(`archive not found: ${archive}`);
if (fs.existsSync("/app/data")) fail("this looks like the production container (/app/data exists) — run the drill on another machine");

const TABLES = ["User", "Customer", "Lead", "Quotation", "Job", "Payment", "Invoice", "FollowUp", "Staff", "Attendance", "Expense", "Notification", "AuditLog", "OpsReminder"];

function counts(dbFile) {
  const db = new Database(dbFile, { readonly: true });
  try {
    const integrity = db.pragma("integrity_check", { simple: true });
    const existing = new Set(db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name));
    const rows = {};
    for (const t of TABLES) if (existing.has(t)) rows[t] = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
    return { integrity, rows, tables: existing.size };
  } finally {
    db.close();
  }
}

function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        files += 1;
        bytes += fs.statSync(p).size;
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return { files, bytes };
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sahara-restore-drill-"));
const started = Date.now();
try {
  // 1. extract (--force-local: a Windows "C:\..." path is not host:path)
  const tar = spawnSync("tar", ["--force-local", "-xzf", path.resolve(archive), "-C", work], { encoding: "utf8" });
  if (tar.status !== 0) fail(`could not extract archive: ${tar.stderr || tar.error}`);
  const restored = path.join(work, "dev.db");
  if (!fs.existsSync(restored)) fail("archive does not contain dev.db");

  // 2. integrity + counts of the backup as taken
  const before = counts(restored);
  if (before.integrity !== "ok") fail(`integrity_check on the backup: ${before.integrity}`);
  if (!before.rows.User) fail("backup has no users");

  // 3. migrate a COPY with the current code's schema setup
  const migrated = path.join(work, "restored-copy.db");
  fs.copyFileSync(restored, migrated);
  const setup = spawnSync(process.execPath, [path.join(repo, "scripts", "db-setup.mjs")], {
    cwd: repo,
    env: { ...process.env, DATABASE_URL: `file:${migrated}` },
    encoding: "utf8",
  });
  if (setup.status !== 0) fail(`db-setup on the restored copy failed:\n${(setup.stderr || setup.stdout).slice(-800)}`);

  // 4. re-check after migration; nothing may be lost
  const after = counts(migrated);
  if (after.integrity !== "ok") fail(`integrity_check after migration: ${after.integrity}`);
  const lost = Object.entries(before.rows).filter(([t, n]) => (after.rows[t] ?? 0) < n);
  if (lost.length) fail(`rows missing after migration: ${lost.map(([t]) => t).join(", ")}`);
  const uploads = dirStats(path.join(work, "uploads"));

  console.log(
    JSON.stringify(
      {
        result: "RESTORABLE",
        archive: path.basename(archive),
        archiveBytes: fs.statSync(archive).size,
        integrity: { backup: before.integrity, afterMigration: after.integrity },
        tables: { backup: before.tables, afterMigration: after.tables },
        rowCounts: before.rows,
        uploads,
        seconds: Math.round((Date.now() - started) / 100) / 10,
        tempFolder: keep ? work : "deleted",
      },
      null,
      2,
    ),
  );
} finally {
  if (!keep) fs.rmSync(work, { recursive: true, force: true });
}
