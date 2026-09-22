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
import bcrypt from "bcryptjs";
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

// Performance audit (Phase 9, 2026-09-21): Lead.mobile and Job.customerMobile
// are queried by findFirst/findMany (never findUnique, so no automatic
// unique-constraint index) in many hot paths — missed-call and WhatsApp-
// inquiry auto-lead lookups, searchCustomersQuick, getRepeatCustomerSummary,
// getCustomersList, login-ID recovery — and neither had an index at all,
// meaning every one of those was a full table scan on SQLite. Both leads
// and jobs are in the thousands already and only grow.
db.exec(`CREATE INDEX IF NOT EXISTS "Lead_mobile_idx" ON "Lead"("mobile");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Job_customerMobile_idx" ON "Job"("customerMobile");`);

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

console.log("Final go-live batch migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Final production access mapping. Deterministic by email → idempotent and
// safe to re-run. Login emails & passwords unchanged.
// admin@       Altaf Shaikh      → ADMIN (Super Admin, full access)
// operations@  Francis Monteiro  → SUPERVISOR (Field Coordinator — moved
//                                   2026-09-09 from OPERATIONS to field-only
//                                   today/tomorrow operations access)
// accounts@    Shoyab Kazi       → OPERATIONS (Operations Manager — promoted
//                                   2026-09-09 from ACCOUNTS / Office Assistant
//                                   to full daily-operations access)
// supervisor@  Suresh Pawar      → SUPERVISOR (Field Coordinator)
// staff@       Vikas Shinde      → STAFF (Field Staff)
// ─────────────────────────────────────────────────────────────────────────
const finalRoleMap = db.transaction(() => {
  const rows = [
    ["operations@saharacleaningservices.com", "SUPERVISOR", "Francis Monteiro"],
    ["accounts@saharacleaningservices.com", "OPERATIONS", "Shoyab Kazi"],
    ["admin@saharacleaningservices.com", "ADMIN", "Altaf Shaikh"],
    ["supervisor@saharacleaningservices.com", "SUPERVISOR", null],
    ["staff@saharacleaningservices.com", "STAFF", null],
  ];
  let changed = 0;
  for (const [email, role, name] of rows) {
    const r = db
      .prepare(`UPDATE "User" SET "role" = ? WHERE "email" = ? AND "role" != ?`)
      .run(role, email, role);
    changed += r.changes;
    if (name) {
      db.prepare(`UPDATE "User" SET "name" = ? WHERE "email" = ? AND "name" != ?`).run(
        name,
        email,
        name
      );
    }
  }
  if (changed) console.log(`Final access mapping applied (${changed} role change(s)).`);
});
finalRoleMap();

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt V1.0 batch (2026-09-09) — additive columns + new tables for
// the booking-form redesign, staff profiles, vehicles, AMC, payments,
// company documents, security OTP and real-time notifications. Plus a
// one-time, row-preserving rebuild of Lead / Expense to drop the stale enum
// CHECK constraints that block the new LeadSource / ExpenseCategory values.
// Everything below is idempotent and safe to re-run.
// ─────────────────────────────────────────────────────────────────────────

// --- row-preserving CHECK-constraint removal -----------------------------
function dropEnumChecks(table) {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  if (!row || !/\sCHECK\s*\("/i.test(row.sql)) return; // already clean → no-op
  const indexes = db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`
    )
    .all(table);
  const cols = db
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((c) => `"${c.name}"`)
    .join(", ");
  const newSql = row.sql
    .replace(/\s+CHECK\s*\("[A-Za-z_]+"\s+IN\s*\([^)]*\)\)/gi, "")
    .replace(new RegExp(`CREATE TABLE "${table}"`), `CREATE TABLE "${table}__new"`);
  db.pragma("foreign_keys = OFF");
  const rebuild = db.transaction(() => {
    db.exec(newSql);
    db.exec(`INSERT INTO "${table}__new" (${cols}) SELECT ${cols} FROM "${table}"`);
    db.exec(`DROP TABLE "${table}"`);
    db.exec(`ALTER TABLE "${table}__new" RENAME TO "${table}"`);
    for (const i of indexes) db.exec(i.sql);
  });
  rebuild();
  db.pragma("foreign_keys = ON");
  const check = db.prepare(`PRAGMA integrity_check`).get();
  console.log(
    `Rebuilt "${table}" without enum CHECK constraints (integrity_check: ${
      check.integrity_check ?? JSON.stringify(check)
    }).`
  );
}
dropEnumChecks("Lead");
dropEnumChecks("Expense");

// --- additive columns --------------------------------------------------
addColumnIfMissing("Lead", "pinCode", `"pinCode" TEXT`);
addColumnIfMissing("Lead", "addOnServices", `"addOnServices" TEXT`);
addColumnIfMissing("Job", "pinCode", `"pinCode" TEXT`);

addColumnIfMissing("Staff", "alternateMobile", `"alternateMobile" TEXT`);
addColumnIfMissing("Staff", "joiningDate", `"joiningDate" DATETIME`);
addColumnIfMissing("Staff", "reference", `"reference" TEXT`);
addColumnIfMissing("Staff", "bankAccount", `"bankAccount" TEXT`);
addColumnIfMissing("Staff", "bankIfsc", `"bankIfsc" TEXT`);
addColumnIfMissing("Staff", "gpayNumber", `"gpayNumber" TEXT`);
addColumnIfMissing("Staff", "documents", `"documents" TEXT`);

addColumnIfMissing("Vehicle", "currentKm", `"currentKm" INTEGER`);
addColumnIfMissing("Vehicle", "lastServiceDate", `"lastServiceDate" DATETIME`);
addColumnIfMissing("Vehicle", "nextServiceDate", `"nextServiceDate" DATETIME`);

addColumnIfMissing("AmcContract", "serviceReminderDate", `"serviceReminderDate" DATETIME`);
addColumnIfMissing("AmcContract", "contractExpiryDate", `"contractExpiryDate" DATETIME`);

addColumnIfMissing("Payment", "invoiceAttachmentUrl", `"invoiceAttachmentUrl" TEXT`);

addColumnIfMissing("CompanySettings", "website", `"website" TEXT`);

// The moment this flag is introduced, every non-admin account is asked to
// replace the shared onboarding password with a personal one on next login.
// Runs exactly once (only when the column is first added) → idempotent.
if (addColumnIfMissing("User", "mustChangePassword", `"mustChangePassword" BOOLEAN NOT NULL DEFAULT false`)) {
  const r = db
    .prepare(
      `UPDATE "User" SET "mustChangePassword" = 1 WHERE "email" != 'admin@saharacleaningservices.com'`
    )
    .run();
  console.log(`Flagged ${r.changes} non-admin account(s) to set a personal password on next login.`);
}

addColumnIfMissing("IntegrationSettings", "mybillbookApiKey", `"mybillbookApiKey" TEXT`);
addColumnIfMissing("IntegrationSettings", "mybillbookVerifiedAt", `"mybillbookVerifiedAt" DATETIME`);
addColumnIfMissing("IntegrationSettings", "webPushPublicKey", `"webPushPublicKey" TEXT`);
addColumnIfMissing("IntegrationSettings", "webPushPrivateKey", `"webPushPrivateKey" TEXT`);
addColumnIfMissing("IntegrationSettings", "webPushSubject", `"webPushSubject" TEXT`);

// --- new tables -------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS "CompanyDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "CompanyDocument_category_idx" ON "CompanyDocument"("category");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "SecurityOtp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purpose" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetUserName" TEXT NOT NULL,
    "targetUserEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePlain" TEXT,
    "payload" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
addColumnIfMissing("SecurityOtp", "codePlain", `"codePlain" TEXT`);
addColumnIfMissing("SecurityOtp", "payload", `"payload" TEXT`);
addColumnIfMissing("SecurityOtp", "requestedByName", `"requestedByName" TEXT`);
db.exec(`CREATE INDEX IF NOT EXISTS "SecurityOtp_targetUserId_idx" ON "SecurityOtp"("targetUserId");`);
db.exec(`CREATE INDEX IF NOT EXISTS "SecurityOtp_expiresAt_idx" ON "SecurityOtp"("expiresAt");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "meta" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");`);
db.exec(`CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");`);

console.log("Master Prompt V1.0 batch migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// v1.1 Production Polish (2026-09-09) — job status flow (PENDING/POSTPONED/
// CANCELLED), booking packages & combos, multi-staff on leads. Additive +
// idempotent. Job.status keeps a stale enum CHECK from the initial migration,
// so rebuild the table (row-preserving) to drop it, same as Lead/Expense.
// ─────────────────────────────────────────────────────────────────────────

dropEnumChecks("Job");

addColumnIfMissing("Lead", "packageName", `"packageName" TEXT`);
addColumnIfMissing("Lead", "comboServices", `"comboServices" TEXT`);
addColumnIfMissing("Lead", "assignedStaffIds", `"assignedStaffIds" TEXT`);
addColumnIfMissing("Job", "packageName", `"packageName" TEXT`);
addColumnIfMissing("Job", "comboServices", `"comboServices" TEXT`);

console.log("v1.1 Production Polish migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// v1.2 — Advance payments through the flow. Additive columns only; no table
// rebuild (Payment.status keeps its CHECK — "Partial" is derived, not stored;
// JobStatus.REACTIVATED needs no CHECK change since the Job table CHECK was
// already dropped in the v1.1 rebuild).
// ─────────────────────────────────────────────────────────────────────────

addColumnIfMissing("Lead", "advanceAmount", `"advanceAmount" REAL`);
addColumnIfMissing("Lead", "paymentMode", `"paymentMode" TEXT`);
addColumnIfMissing("Lead", "paymentStatus", `"paymentStatus" TEXT`);
addColumnIfMissing("Payment", "mode", `"mode" TEXT`);
addColumnIfMissing("CompanySettings", "upiId", `"upiId" TEXT`);
addColumnIfMissing("CompanySettings", "upiQrUrl", `"upiQrUrl" TEXT`);
addColumnIfMissing("CompanySettings", "bankName", `"bankName" TEXT`);
addColumnIfMissing("CompanySettings", "bankAccountName", `"bankAccountName" TEXT`);
addColumnIfMissing("CompanySettings", "bankAccountNumber", `"bankAccountNumber" TEXT`);
addColumnIfMissing("CompanySettings", "bankIfsc", `"bankIfsc" TEXT`);

console.log("v1.2 advance-payments migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// v1.1 — Mobile-number login for the three office users. One-time, guarded by
// a 'V11_MOBILE_AUTH' AuditLog sentinel so passwords are NOT reset on every
// deploy. Sets the login mobile number + a temporary password; each user is
// then forced through /set-password on first login. Preserves all data.
// admin@       Altaf Shaikh      → 7083347130 / Sahara1 (Super Admin)
// operations@  Francis Monteiro  → 8530207130 / Sahara2 (Field Coordinator)
// accounts@    Shoyab Kazi       → 8956567130 / Sahara3 (Operations Manager)
// ─────────────────────────────────────────────────────────────────────────
{
  const alreadyDone = db
    .prepare(`SELECT COUNT(*) AS c FROM "AuditLog" WHERE "action" = 'V11_MOBILE_AUTH'`)
    .get().c;
  if (!alreadyDone) {
    const rows = [
      ["admin@saharacleaningservices.com", "7083347130", "Sahara1", "ADMIN", "Altaf Shaikh"],
      ["operations@saharacleaningservices.com", "8530207130", "Sahara2", "SUPERVISOR", "Francis Monteiro"],
      ["accounts@saharacleaningservices.com", "8956567130", "Sahara3", "OPERATIONS", "Shoyab Kazi"],
    ];
    const apply = db.transaction(() => {
      // Free up any phone numbers about to be reassigned first.
      db.prepare(`UPDATE "User" SET "phone" = NULL WHERE "phone" IN ('7083347130','8530207130','8956567130')`).run();
      for (const [email, phone, pw, role, name] of rows) {
        db.prepare(
          `UPDATE "User" SET "phone" = ?, "passwordHash" = ?, "role" = ?, "name" = ?, "mustChangePassword" = 1 WHERE "email" = ?`
        ).run(phone, bcrypt.hashSync(pw, 10), role, name, email);
      }
      db.prepare(
        `INSERT INTO "AuditLog" ("id","entityType","entityId","action","summary","createdAt")
         VALUES (?, 'Security', 'auth', 'V11_MOBILE_AUTH', 'Mobile-number login enabled for the 3 office users; temporary passwords set', CURRENT_TIMESTAMP)`
      ).run("migv11-mobile-auth");
    });
    apply();
    console.log("v1.1 mobile-number auth applied (3 users → mobile login + temp password + must-change).");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v2.0 — Batch 1: Monthly attendance, salary ledger, audit
// trail and month closing. Additive + row-preserving; safe to re-run.
// ─────────────────────────────────────────────────────────────────────────

// Attendance.status gained WEEKLY_OFF — drop the stale CHECK IN (...) so the
// new value is accepted (row-preserving rebuild, keeps unique+indexes).
dropEnumChecks("Attendance");

addColumnIfMissing("Attendance", "markedByName", `"markedByName" TEXT`);
addColumnIfMissing("Attendance", "updatedByName", `"updatedByName" TEXT`);
addColumnIfMissing("Attendance", "updatedAt", `"updatedAt" DATETIME`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "AttendanceAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "editedByName" TEXT NOT NULL,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "AttendanceAudit_staffId_date_idx" ON "AttendanceAudit"("staffId", "date");`);
db.exec(`CREATE INDEX IF NOT EXISTS "AttendanceAudit_editedAt_idx" ON "AttendanceAudit"("editedAt");`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "MonthClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closedByName" TEXT NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedByName" TEXT,
    "reopenedAt" DATETIME
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "MonthClose_year_month_key" ON "MonthClose"("year", "month");`);

console.log("v2.0 batch-1 (attendance/salary) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v2.0 — Batch 2: Premium booking page. Additive columns only.
// ─────────────────────────────────────────────────────────────────────────
addColumnIfMissing("Lead", "propertyType", `"propertyType" TEXT`);
addColumnIfMissing("Job", "propertyType", `"propertyType" TEXT`);
addColumnIfMissing("CompanySettings", "googleRating", `"googleRating" TEXT`);
addColumnIfMissing("CompanySettings", "googleReviewCount", `"googleReviewCount" TEXT`);
addColumnIfMissing("CompanySettings", "happyCustomers", `"happyCustomers" TEXT`);
addColumnIfMissing("CompanySettings", "featuredReviews", `"featuredReviews" TEXT`);
db.prepare(
  `UPDATE "CompanySettings" SET
    "googleRating" = COALESCE("googleRating", '4.9'),
    "googleReviewCount" = COALESCE("googleReviewCount", '1800+'),
    "happyCustomers" = COALESCE("happyCustomers", '8000+')
   WHERE "id" = 'default'`
).run();
console.log("v2.0 batch-2 (premium booking) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v3.1 — Batch 7: personalized customer booking links.
// ─────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "BookingLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOOKING_FORM',
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "leadId" TEXT,
    "jobId" TEXT,
    "createdByName" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME,
    "submittedAt" DATETIME,
    "followUpMade" BOOLEAN NOT NULL DEFAULT 0
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "BookingLink_token_key" ON "BookingLink"("token");`);
db.exec(`CREATE INDEX IF NOT EXISTS "BookingLink_customerMobile_idx" ON "BookingLink"("customerMobile");`);
db.exec(`CREATE INDEX IF NOT EXISTS "BookingLink_sentAt_idx" ON "BookingLink"("sentAt");`);
console.log("v3.1 batch-7 (booking links) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v3.1 — Batch 8: master Customer table (bulk import).
// ─────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "address" TEXT,
    "area" TEXT,
    "serviceHistory" TEXT,
    "lastServiceDate" DATETIME,
    "outstandingBalance" REAL NOT NULL DEFAULT 0,
    "source" TEXT,
    "notes" TEXT,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Customer_mobile_key" ON "Customer"("mobile");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Customer_area_idx" ON "Customer"("area");`);
db.exec(`CREATE INDEX IF NOT EXISTS "Customer_lastServiceDate_idx" ON "Customer"("lastServiceDate");`);
console.log("v3.1 batch-8 (customer master) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v3.1 — Batch 9: Owner Dashboard (bank balance).
// ─────────────────────────────────────────────────────────────────────────
addColumnIfMissing("CompanySettings", "bankBalance", `"bankBalance" REAL`);
console.log("v3.1 batch-9 (owner dashboard) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v3.1 — Batch 10: SMS gateway + delivery log + missed-call lead.
// ─────────────────────────────────────────────────────────────────────────
addColumnIfMissing("IntegrationSettings", "smsProvider", `"smsProvider" TEXT`);
addColumnIfMissing("IntegrationSettings", "smsApiKey", `"smsApiKey" TEXT`);
addColumnIfMissing("IntegrationSettings", "smsSenderId", `"smsSenderId" TEXT`);
addColumnIfMissing("IntegrationSettings", "smsEndpoint", `"smsEndpoint" TEXT`);
addColumnIfMissing("IntegrationSettings", "smsVerifiedAt", `"smsVerifiedAt" DATETIME`);
db.exec(`
  CREATE TABLE IF NOT EXISTS "SmsMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toNumber" TEXT NOT NULL,
    "toName" TEXT,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "SmsMessage_status_idx" ON "SmsMessage"("status");`);
db.exec(`CREATE INDEX IF NOT EXISTS "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");`);
console.log("v3.1 batch-10 (sms gateway) migration complete.");

db.exec(`
  CREATE TABLE IF NOT EXISTS "EmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "EmailMessage_status_idx" ON "EmailMessage"("status");`);
db.exec(`CREATE INDEX IF NOT EXISTS "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");`);
console.log("Auth recovery (email queue) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Master Prompt v3.3 — Batch 14: marketing gallery (before/after photos and
// result videos), reused on the booking page, WhatsApp links and review
// campaigns. New table only; additive + idempotent.
// ─────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "GalleryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'PHOTO',
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "category" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "jobId" TEXT,
    "pairKey" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS "GalleryItem_type_idx" ON "GalleryItem"("type");`);
db.exec(`CREATE INDEX IF NOT EXISTS "GalleryItem_featured_idx" ON "GalleryItem"("featured");`);
db.exec(`CREATE INDEX IF NOT EXISTS "GalleryItem_category_idx" ON "GalleryItem"("category");`);
console.log("v3.3 batch-14 (marketing gallery) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Phase D — WhatsApp consent/opt-out tracking (idempotent, additive only).
// New table only; sendWhatsApp() / flushWhatsAppQueue() check it before
// every send, and the inbound webhook flips it on a STOP/START reply. See
// src/lib/whatsapp.ts and src/app/api/webhooks/whatsapp/route.ts.
// ─────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "WhatsAppConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" DATETIME,
    "optedOutVia" TEXT,
    "reinstatedAt" DATETIME,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConsent_phoneNumber_key" ON "WhatsAppConsent"("phoneNumber");`);
db.exec(`CREATE INDEX IF NOT EXISTS "WhatsAppConsent_optedOut_idx" ON "WhatsAppConsent"("optedOut");`);
console.log("Phase D (WhatsApp consent tracking) migration complete.");

// ─────────────────────────────────────────────────────────────────────────
// Google Reviews response workflow (idempotent, additive only). No ingestion
// API is connected, so staff log a review when they see it and mark it once
// replied — see src/server/actions/reviews.ts.
// ─────────────────────────────────────────────────────────────────────────
addColumnIfMissing("Review", "replied", `"replied" BOOLEAN NOT NULL DEFAULT false`);
addColumnIfMissing("Review", "repliedAt", `"repliedAt" DATETIME`);
addColumnIfMissing("Review", "replyNote", `"replyNote" TEXT`);
db.exec(`CREATE INDEX IF NOT EXISTS "Review_replied_idx" ON "Review"("replied");`);
console.log("Review response workflow migration complete.");

db.close();
// ─────────────────────────────────────────────────────────────────────────
// Owner Command Center — monthly business revenue target (ADMIN-editable).
// New table only; additive + idempotent. Opens its own short-lived
// connection since the module-level `db` above is already closed by this
// point in the script.
// ─────────────────────────────────────────────────────────────────────────
{
  const ownerDb = new Database(dbPath);
  ownerDb.pragma("foreign_keys = ON");
  ownerDb.exec(`
    CREATE TABLE IF NOT EXISTS "BusinessTarget" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "targetAmount" REAL NOT NULL,
      "setByName" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ownerDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "BusinessTarget_year_month_key" ON "BusinessTarget"("year", "month");`);
  console.log("Owner Command Center (business target) migration complete.");
  ownerDb.close();
}

// ─────────────────────────────────────────────────────────────────────────
// Quotation/Invoice status workflow + MyBillBook API removal (2026-09-22,
// idempotent, additive-and-one-safe-drop). Own connection since `db` above
// is already closed by this point in the script.
// ─────────────────────────────────────────────────────────────────────────
{
  const qiDb = new Database(dbPath);
  qiDb.pragma("foreign_keys = ON");

  function addCol(table, column, ddl) {
    const cols = qiDb.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    if (!cols.includes(column)) qiDb.exec(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
  function dropCol(table, column) {
    const cols = qiDb.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    if (cols.includes(column)) qiDb.exec(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
  }

  addCol("Quotation", "discount", `"discount" REAL NOT NULL DEFAULT 0`);
  addCol("Quotation", "status", `"status" TEXT NOT NULL DEFAULT 'SENT'`);
  addCol("Quotation", "updatedAt", `"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
  qiDb.exec(`CREATE INDEX IF NOT EXISTS "Quotation_status_idx" ON "Quotation"("status");`);

  addCol("Invoice", "quotationId", `"quotationId" TEXT`);
  addCol("Invoice", "discount", `"discount" REAL NOT NULL DEFAULT 0`);
  addCol("Invoice", "notes", `"notes" TEXT`);
  addCol("Invoice", "terms", `"terms" TEXT`);
  addCol("Invoice", "status", `"status" TEXT NOT NULL DEFAULT 'ISSUED'`);
  addCol("Invoice", "updatedAt", `"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
  qiDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_quotationId_key" ON "Invoice"("quotationId");`);
  qiDb.exec(`CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");`);

  // MyBillBook API integration removed (2026-09-22) — API was never
  // configured in production (no key ever issued); these columns only ever
  // held NULL/"NOT_CONFIGURED". Safe to drop outright.
  dropCol("Invoice", "mybillbookInvoiceId");
  dropCol("Invoice", "mybillbookSyncStatus");
  dropCol("IntegrationSettings", "mybillbookApiKey");
  dropCol("IntegrationSettings", "mybillbookVerifiedAt");

  console.log("Quotation/Invoice status workflow + MyBillBook removal migration complete.");
  qiDb.close();
}
