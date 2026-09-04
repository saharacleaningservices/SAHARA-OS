// Sahara OS — offline-safe database setup.
//
// Applies prisma/migrations/00000000000000_init/migration.sql directly with
// better-sqlite3. This does the same job as `prisma migrate deploy` but
// never needs to reach the network, so it works even on machines/sandboxes
// that block Prisma's engine-download CDN (binaries.prisma.sh).
//
// On a normal machine with unrestricted internet access you can use the
// standard `npx prisma migrate dev` / `npx prisma migrate deploy` instead —
// both approaches produce an identical schema. See README.md.

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));

mkdirSync(path.dirname(dbPath), { recursive: true });

const migrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "00000000000000_init",
  "migration.sql"
);

if (!existsSync(migrationPath)) {
  console.error("Migration file not found:", migrationPath);
  process.exit(1);
}

const sql = readFileSync(migrationPath, "utf-8");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const alreadyInitialized = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'")
  .get();

if (alreadyInitialized) {
  console.log(`Database already initialized at ${dbPath} — skipping schema creation.`);
} else {
  db.exec(sql);
  console.log(`Sahara OS database created at ${dbPath}`);
}

// Tables added after the initial migration — created idempotently so existing
// production databases pick them up on the next deploy.
db.exec(`
  CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Sahara Cleaning Services',
    "phone" TEXT NOT NULL DEFAULT '7083347130',
    "email" TEXT NOT NULL DEFAULT 'contact@saharacleaningservices.com',
    "address" TEXT NOT NULL DEFAULT 'Opp. South Gate, Magarpatta City, Hadapsar, Pune.',
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.prepare(`INSERT OR IGNORE INTO "CompanySettings" ("id") VALUES ('default')`).run();
console.log("Ensured CompanySettings table exists.");

// ─────────────────────────────────────────────────────────────────────────
// Phase 1 — Smart Enquiry Hub structural upgrades (idempotent).
// ─────────────────────────────────────────────────────────────────────────

// Conversation timeline (new table).
db.exec(`
  CREATE TABLE IF NOT EXISTS "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT,
    "audioUrl" TEXT,
    "meta" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "TimelineEntry_leadId_idx" ON "TimelineEntry"("leadId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "TimelineEntry_createdAt_idx" ON "TimelineEntry"("createdAt");`);

// FollowUp.priority column.
const followUpCols = db.prepare(`PRAGMA table_info("FollowUp")`).all().map((c) => c.name);
if (!followUpCols.includes("priority")) {
  db.exec(`ALTER TABLE "FollowUp" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'MEDIUM';`);
  console.log("Added FollowUp.priority column.");
}

// The initial migration wrote CHECK constraints for the Lead.stage and
// FollowUp.type enums. Phase 1 changes both enum sets, and SQLite cannot ALTER
// a CHECK constraint — so rebuild the two tables WITHOUT the enum CHECKs
// (Prisma validates enum values client-side anyway). Only ever done while there
// are zero leads, so it can never touch real customer data.
const leadTableSql =
  db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='Lead'`).get()?.sql || "";
const leadCount = db.prepare(`SELECT COUNT(*) AS c FROM "Lead"`).get().c;

if (leadTableSql.includes("'QUOTE_SENT'")) {
  if (leadCount > 0) {
    console.warn(
      `WARNING: Lead table still has the old stage CHECK but holds ${leadCount} rows — skipping rebuild. Migrate manually.`
    );
  } else {
    db.pragma("foreign_keys = OFF");
    const rebuild = db.transaction(() => {
      db.exec(`DROP TABLE "FollowUp";`);
      db.exec(`DROP TABLE "Lead";`);
      db.exec(`
        CREATE TABLE "Lead" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "leadNumber" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "mobile" TEXT NOT NULL,
          "whatsapp" TEXT,
          "address" TEXT,
          "area" TEXT NOT NULL,
          "service" TEXT NOT NULL CHECK ("service" IN ('HOME_DEEP_CLEANING','COMMERCIAL_CLEANING','HOUSEKEEPING','PEST_CONTROL','INTERIOR_PAINTING')),
          "source" TEXT NOT NULL CHECK ("source" IN ('WHATSAPP','CALL','WEBSITE','GOOGLE')),
          "quoteAmount" REAL,
          "stage" TEXT NOT NULL DEFAULT 'NEW',
          "followUpDate" DATETIME,
          "notes" TEXT,
          "assignedStaffId" TEXT,
          "assignedToId" TEXT,
          "createdById" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Lead_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      db.exec(`CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");`);
      db.exec(`CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");`);
      db.exec(`CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");`);
      db.exec(`CREATE INDEX "Lead_source_idx" ON "Lead"("source");`);
      db.exec(`CREATE INDEX "Lead_area_idx" ON "Lead"("area");`);
      db.exec(`CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");`);
      db.exec(`
        CREATE TABLE "FollowUp" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "leadId" TEXT NOT NULL,
          "dueDate" DATETIME NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'CALL',
          "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
          "notes" TEXT,
          "isDone" BOOLEAN NOT NULL DEFAULT false,
          "doneAt" DATETIME,
          "assignedToId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      db.exec(`CREATE INDEX "FollowUp_dueDate_idx" ON "FollowUp"("dueDate");`);
      db.exec(`CREATE INDEX "FollowUp_isDone_idx" ON "FollowUp"("isDone");`);
    });
    rebuild();
    db.pragma("foreign_keys = ON");
    console.log("Rebuilt Lead + FollowUp tables (dropped stale enum CHECK constraints).");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — Production Foundation (idempotent, additive only).
// ─────────────────────────────────────────────────────────────────────────

function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
    return true;
  }
  return false;
}

addColumnIfMissing("Lead", "serviceCategory", `"serviceCategory" TEXT`);
addColumnIfMissing("Lead", "serviceVariant", `"serviceVariant" TEXT`);
addColumnIfMissing("Lead", "mapLink", `"mapLink" TEXT`);
addColumnIfMissing("Job", "mapLink", `"mapLink" TEXT`);
addColumnIfMissing("Job", "vehicleId", `"vehicleId" TEXT`);

// Soft-delete columns on every deletable entity. isDemo is tracked per table so
// pre-existing rows can be marked as demo data exactly once, the moment the
// column is introduced — never again afterwards.
const demoJustAdded = {};
for (const table of ["Lead", "Job", "Staff", "Payment", "Expense"]) {
  addColumnIfMissing(table, "deletedAt", `"deletedAt" DATETIME`);
  addColumnIfMissing(table, "deletedByName", `"deletedByName" TEXT`);
  demoJustAdded[table] = addColumnIfMissing(table, "isDemo", `"isDemo" BOOLEAN NOT NULL DEFAULT false`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "type" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "MaterialIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" TEXT,
    "issuedByName" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "MaterialIssue_jobId_idx" ON "MaterialIssue"("jobId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerMobile" TEXT NOT NULL,
    "customerName" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "Review_customerMobile_idx" ON "Review"("customerMobile");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "BackupEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "BackupEvent_createdAt_idx" ON "BackupEvent"("createdAt");`);

// One-time: the moment isDemo is introduced on a table, every row already in
// it is — by construction — the seed/demo data shipped with this project, so
// mark it. Any row created after this point defaults to isDemo=false.
for (const table of ["Staff", "Job", "Payment", "Expense"]) {
  if (demoJustAdded[table]) {
    db.exec(`UPDATE "${table}" SET "isDemo" = true`);
    console.log(`Marked pre-existing ${table} rows as demo data.`);
  }
}

// One-time correction: fix the seeded names that were swapped relative to the
// real Operations Manager / Office Accountant assignment.
db.prepare(
  `UPDATE "User" SET "name" = 'Francis D''Souza' WHERE "email" = 'operations@saharacleaningservices.com' AND "name" != 'Francis D''Souza'`
).run();
db.prepare(
  `UPDATE "User" SET "name" = 'Shoyab Shaikh' WHERE "email" = 'accounts@saharacleaningservices.com' AND "name" != 'Shoyab Shaikh'`
).run();

console.log("Phase 2 (Production Foundation) migration complete.");

db.close();
