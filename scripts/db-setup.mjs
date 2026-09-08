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

// ─────────────────────────────────────────────────────────────────────────
// Phase 3 — Revenue, WhatsApp & Workforce Automation (idempotent, additive).
// ─────────────────────────────────────────────────────────────────────────

addColumnIfMissing("Lead", "referralCode", `"referralCode" TEXT`);
addColumnIfMissing("CompanySettings", "googleReviewUrl", `"googleReviewUrl" TEXT`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "toName" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "WhatsAppMessage_kind_idx" ON "WhatsAppMessage"("kind");`);
db.exec(`CREATE INDEX IF NOT EXISTS "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");`);
db.exec(`CREATE INDEX IF NOT EXISTS "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "AmcContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "address" TEXT,
    "area" TEXT,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "amount" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "nextVisitDate" DATETIME NOT NULL,
    "lastVisitDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "leadId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AmcContract_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "AmcContract_contractNumber_key" ON "AmcContract"("contractNumber");`);
db.exec(`CREATE INDEX IF NOT EXISTS "AmcContract_status_idx" ON "AmcContract"("status");`);
db.exec(`CREATE INDEX IF NOT EXISTS "AmcContract_nextVisitDate_idx" ON "AmcContract"("nextVisitDate");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "AmcVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amcId" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL,
    "jobId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AmcVisit_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AmcContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "AmcVisit_amcId_idx" ON "AmcVisit"("amcId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "UpsellRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "triggerCategory" TEXT NOT NULL,
    "comboCategory" TEXT NOT NULL,
    "comboVariant" TEXT,
    "comboPrice" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.prepare(
  `INSERT OR IGNORE INTO "UpsellRule" ("id", "label", "triggerCategory", "comboCategory", "comboVariant", "comboPrice") VALUES (?, ?, ?, ?, ?, ?)`
).run("seed-upsell-1", "Add Sofa Cleaning", "HOME_DEEP_CLEANING", "INDIVIDUAL_CLEANING", "Sofa", 999);
db.prepare(
  `INSERT OR IGNORE INTO "UpsellRule" ("id", "label", "triggerCategory", "comboCategory", "comboVariant", "comboPrice") VALUES (?, ?, ?, ?, ?, ?)`
).run("seed-upsell-2", "Add Deep Cleaning", "PAINTING", "HOME_DEEP_CLEANING", "2 BHK", 2999);
db.prepare(
  `INSERT OR IGNORE INTO "UpsellRule" ("id", "label", "triggerCategory", "comboCategory", "comboVariant", "comboPrice") VALUES (?, ?, ?, ?, ?, ?)`
).run("seed-upsell-3", "Add Kitchen Cleaning", "PEST_CONTROL", "INDIVIDUAL_CLEANING", "Kitchen", 799);

db.exec(`
  CREATE TABLE IF NOT EXISTS "UpsellEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT,
    "leadId" TEXT,
    "label" TEXT NOT NULL,
    "comboValue" REAL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "UpsellEvent_leadId_idx" ON "UpsellEvent"("leadId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "UpsellEvent_accepted_idx" ON "UpsellEvent"("accepted");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Advance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT,
    "givenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "givenByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Advance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "Advance_staffId_idx" ON "Advance"("staffId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "FineRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FineRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "FineRecord_staffId_idx" ON "FineRecord"("staffId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "RewardRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "RewardRecord_staffId_idx" ON "RewardRecord"("staffId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "jobId" TEXT,
    "paymentId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT,
    "customerAddress" TEXT,
    "lineItems" TEXT NOT NULL,
    "subTotal" REAL NOT NULL,
    "gstPercent" REAL NOT NULL DEFAULT 0,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "pdfUrl" TEXT,
    "mybillbookInvoiceId" TEXT,
    "mybillbookSyncStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_jobId_key" ON "Invoice"("jobId");`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_paymentId_key" ON "Invoice"("paymentId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Invoice_jobId_idx" ON "Invoice"("jobId");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "JobVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobVideo_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "JobVideo_jobId_idx" ON "JobVideo"("jobId");`);

console.log("Phase 3 (Revenue, WhatsApp & Workforce Automation) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Production hardening — persistent disk, owner-controlled device login,
// security (idempotent, additive).
// ─────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "otpCode" TEXT,
    "otpExpiresAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedByName" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Device_token_key" ON "Device"("token");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Device_userId_idx" ON "Device"("userId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Device_status_idx" ON "Device"("status");`);

console.log("Production hardening migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Coolify go-live — optional Lead email, customer-facing service date, and
// Team 1–4 assignment that carries into Jobs (idempotent, additive only).
// ─────────────────────────────────────────────────────────────────────────

addColumnIfMissing("Lead", "email", `"email" TEXT`);
addColumnIfMissing("Lead", "serviceDate", `"serviceDate" DATETIME`);
addColumnIfMissing("Lead", "teamNumber", `"teamNumber" INTEGER`);
addColumnIfMissing("Job", "teamNumber", `"teamNumber" INTEGER`);

console.log("Coolify go-live migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Connector layer — one "default" row holding WhatsApp Cloud API, Google
// Maps and Google Drive backup settings, editable from /settings without a
// redeploy. New table only; nothing on existing tables is touched.
// (idempotent, additive only.)
// ─────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS "IntegrationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "whatsappAccessToken" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "whatsappBusinessId" TEXT,
    "whatsappApiVersion" TEXT NOT NULL DEFAULT 'v21.0',
    "whatsappVerifiedAt" DATETIME,
    "whatsappLastError" TEXT,
    "googleMapsApiKey" TEXT,
    "googleMapsVerifiedAt" DATETIME,
    "backupToken" TEXT,
    "gdriveFolderId" TEXT,
    "backupVerifiedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT
  );
`);
db.prepare(`INSERT OR IGNORE INTO "IntegrationSettings" ("id") VALUES ('default')`).run();
console.log("Ensured IntegrationSettings table exists.");

// ─────────────────────────────────────────────────────────────────────────
// Final production go-live batch (2026-09-08) — additive columns for the
// public booking form + job card, and a one-time role re-assignment.
// ─────────────────────────────────────────────────────────────────────────

addColumnIfMissing("Lead", "alternateMobile", `"alternateMobile" TEXT`);
addColumnIfMissing("Lead", "timeSlot", `"timeSlot" TEXT`);
addColumnIfMissing("Job", "alternateMobile", `"alternateMobile" TEXT`);
addColumnIfMissing("Job", "serviceVariant", `"serviceVariant" TEXT`);

// One-time role re-assignment: Shoyab Shaikh becomes Operations Manager,
// Francis D'Souza becomes Field Coordinator. Each guard checks the CURRENT
// role, so this is a no-op once applied and safe to re-run. Login emails
// and passwords are unchanged — only the role each account carries.
const roleSwap = db.transaction(() => {
  const a = db
    .prepare(
      `UPDATE "User" SET "role" = 'OPERATIONS' WHERE "email" = 'accounts@saharacleaningservices.com' AND "role" = 'ACCOUNTS'`
    )
    .run();
  const b = db
    .prepare(
      `UPDATE "User" SET "role" = 'SUPERVISOR' WHERE "email" = 'operations@saharacleaningservices.com' AND "role" = 'OPERATIONS'`
    )
    .run();
  if (a.changes || b.changes) {
    console.log(
      `Role re-assignment applied (accounts@ → OPERATIONS: ${a.changes}, operations@ → SUPERVISOR: ${b.changes}).`
    );
  }
});
roleSwap();

console.log("Final go-live batch migration complete.");

db.close();
