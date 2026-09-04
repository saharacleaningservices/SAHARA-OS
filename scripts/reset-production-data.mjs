// Sahara OS — production data reset.
//
// Wipes every business-data table to zero rows while keeping User,
// CompanySettings (branding/company config), and UpsellRule (the combo
// catalog — a config table, not a business record) fully intact. Login,
// roles and permissions are untouched because none of that lives outside
// the User table.
//
// This is a deliberately manual, human-run tool: it does nothing unless
// invoked with --yes, and --dry-run lets you preview row counts with zero
// writes. It is NOT wired into db-setup.mjs / render-start.mjs and will
// never run automatically on deploy.
//
//   node scripts/reset-production-data.mjs --dry-run
//   node scripts/reset-production-data.mjs --yes
//
// What happens, in order:
//   1. A timestamped VACUUM INTO snapshot of the live database is taken
//      first, unconditionally, next to the DB file — a restore point in
//      case anything here needs to be undone. (Skipped in --dry-run.)
//   2. Every table below is deleted inside ONE transaction, children
//      before parents, so it is a single atomic all-or-nothing operation —
//      if anything fails, better-sqlite3 rolls the whole transaction back
//      and the database is left exactly as it was.
//   3. Before/after row counts are printed for every table, including the
//      ones intentionally left untouched.
//
// On sequences: every id in this schema is a cuid() TEXT primary key, not
// an INTEGER AUTOINCREMENT column, so SQLite's sqlite_sequence table does
// not exist here (verified: no table in this schema declares
// AUTOINCREMENT). There is nothing to reset at the SQLite level. The
// human-readable numbers you do see — LD-2026-0001, JOB-2026-0001,
// INV-2026-0001 etc. — are computed from each table's row COUNT at
// creation time (see src/lib/id-generators.ts), so once every row is
// deleted, the very next Lead/Job/Payment/Quotation/Certificate/AMC
// contract created will naturally restart at -0001. That's the "sequence
// reset" for this app, and this script produces it automatically — no
// separate step needed. This script still checks for and clears
// sqlite_sequence if a future migration ever introduces one, so nothing
// breaks if that ever changes.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--yes");

if (!isDryRun && !isConfirmed) {
  console.log(`
Sahara OS — production data reset

This permanently deletes ALL leads, customers, jobs, invoices, payments,
expenses, AMC contracts, attendance, staff records, vehicles, photos,
WhatsApp logs, audit logs, and upsell events. Users, roles, company
settings and branding are kept.

Run one of:
  node scripts/reset-production-data.mjs --dry-run   (preview counts, no writes)
  node scripts/reset-production-data.mjs --yes       (actually delete)
`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));

if (!existsSync(dbPath)) {
  console.error("Database not found at", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────────────────────────────────
// Table list. KEPT tables are reported but never touched. DELETE_ORDER is
// children-before-parents so each DELETE is the one actually responsible
// for emptying that table (rather than relying on ON DELETE CASCADE to do
// it silently as a side effect of deleting something else) — that keeps
// the before/after counts printed below meaningful per table.
// ─────────────────────────────────────────────────────────────────────────

const KEPT_TABLES = ["User", "CompanySettings", "UpsellRule"];

const DELETE_ORDER = [
  // Lead children
  "TimelineEntry",
  "FollowUp",
  "Quotation",
  // Shared / Job children
  "ActivityLog",
  "Photo",
  "Certificate",
  "JobVideo",
  "MaterialIssue",
  "JobAssignment",
  "Invoice",
  "Payment",
  "Expense",
  // AMC
  "AmcVisit",
  "AmcContract",
  // Staff financials + attendance
  "Advance",
  "FineRecord",
  "RewardRecord",
  "Attendance",
  // Parents
  "Job",
  "Lead",
  "Staff",
  // Standalone / no incoming FK from anything above
  "Vehicle",
  "WhatsAppMessage",
  "AuditLog",
  "UpsellEvent",
  "Review",
];

function tableExists(name) {
  return Boolean(
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name)
  );
}

function rowCount(name) {
  if (!tableExists(name)) return null; // table doesn't exist in this DB yet
  return db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
}

function printCounts(title, tables) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  for (const t of tables) {
    const c = rowCount(t);
    console.log(`  ${t.padEnd(20)} ${c === null ? "n/a (no table)" : c}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Safety snapshot (skipped for --dry-run, which never writes anything)
// ─────────────────────────────────────────────────────────────────────────

if (!isDryRun) {
  const backupDir = path.join(root, "backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = path.join(backupDir, `pre-reset-${stamp}.db`);
  db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
  console.log(`Safety snapshot written to: ${snapshotPath}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Before counts (kept + deleted tables)
// ─────────────────────────────────────────────────────────────────────────

printCounts("BEFORE — kept tables (untouched)", KEPT_TABLES);
printCounts("BEFORE — tables to be cleared", DELETE_ORDER);

if (isDryRun) {
  console.log("\nDry run only — no rows were deleted, no snapshot was taken.");
  db.close();
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Delete everything, in one atomic transaction
// ─────────────────────────────────────────────────────────────────────────

const runReset = db.transaction(() => {
  for (const table of DELETE_ORDER) {
    if (!tableExists(table)) continue;
    db.prepare(`DELETE FROM "${table}"`).run();
  }

  // No AUTOINCREMENT columns exist in this schema today (every id is a
  // cuid() TEXT primary key), so sqlite_sequence does not exist — this is
  // a no-op guard for safety if that ever changes in a future migration.
  if (tableExists("sqlite_sequence")) {
    for (const table of DELETE_ORDER) {
      db.prepare(`DELETE FROM "sqlite_sequence" WHERE name = ?`).run(table);
    }
  }
});

runReset();

// SQLite doesn't reclaim freed page space until VACUUM runs; do it outside
// the transaction (VACUUM cannot run inside one).
db.exec("VACUUM");

// ─────────────────────────────────────────────────────────────────────────
// 4. After counts
// ─────────────────────────────────────────────────────────────────────────

printCounts("AFTER — kept tables (should be unchanged)", KEPT_TABLES);
printCounts("AFTER — cleared tables (should all be 0)", DELETE_ORDER);

const stillNonEmpty = DELETE_ORDER.filter((t) => (rowCount(t) ?? 0) > 0);
if (stillNonEmpty.length > 0) {
  console.error("\n⚠ These tables are still non-empty after the reset:", stillNonEmpty.join(", "));
  process.exitCode = 1;
} else {
  console.log("\n✅ Production data reset complete. Users, company settings and branding are untouched.");
}

db.close();
