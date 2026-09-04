-- Sahara OS — initial schema
-- Hand-authored to mirror prisma/schema.prisma exactly (see README for why
-- this migration is checked in rather than engine-generated).

PRAGMA foreign_keys = ON;

-- ── User ────────────────────────────────────────────────────────────────
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('ADMIN','OPERATIONS','ACCOUNTS','SUPERVISOR','STAFF')),
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

-- ── Staff ───────────────────────────────────────────────────────────────
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "salaryType" TEXT NOT NULL DEFAULT 'DAILY' CHECK ("salaryType" IN ('DAILY','MONTHLY')),
    "dailyWage" REAL,
    "monthlySalary" REAL,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK ("availability" IN ('AVAILABLE','ON_JOB','ON_LEAVE','OFF_DUTY')),
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "photoUrl" TEXT,
    "notes" TEXT,
    "qrCode" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Staff_employeeCode_key" ON "Staff"("employeeCode");
CREATE UNIQUE INDEX "Staff_qrCode_key" ON "Staff"("qrCode");
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX "Staff_availability_idx" ON "Staff"("availability");
CREATE INDEX "Staff_designation_idx" ON "Staff"("designation");

-- ── Attendance ──────────────────────────────────────────────────────────
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT' CHECK ("status" IN ('PRESENT','ABSENT','HALF_DAY','LEAVE')),
    "checkInTime" DATETIME,
    "checkOutTime" DATETIME,
    "wageForDay" REAL,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Attendance_staffId_date_key" ON "Attendance"("staffId", "date");
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- ── Lead ────────────────────────────────────────────────────────────────
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
    "stage" TEXT NOT NULL DEFAULT 'NEW' CHECK ("stage" IN ('NEW','SITE_VISIT','QUOTE_SENT','NEGOTIATION','CONFIRMED','JOB_SCHEDULED','COMPLETED','PAID')),
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
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");
CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_area_idx" ON "Lead"("area");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- ── Quotation ───────────────────────────────────────────────────────────
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "services" TEXT NOT NULL,
    "subTotal" REAL NOT NULL,
    "gstPercent" REAL NOT NULL DEFAULT 0,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "terms" TEXT NOT NULL,
    "validTill" DATETIME,
    "pdfUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Quotation_quoteNumber_key" ON "Quotation"("quoteNumber");
CREATE INDEX "Quotation_leadId_idx" ON "Quotation"("leadId");

-- ── FollowUp ────────────────────────────────────────────────────────────
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CALL' CHECK ("type" IN ('CALL','WHATSAPP','VISIT','EMAIL')),
    "notes" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "assignedToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "FollowUp_dueDate_idx" ON "FollowUp"("dueDate");
CREATE INDEX "FollowUp_isDone_idx" ON "FollowUp"("isDone");

-- ── Job ─────────────────────────────────────────────────────────────────
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "leadId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "service" TEXT NOT NULL CHECK ("service" IN ('HOME_DEEP_CLEANING','COMMERCIAL_CLEANING','HOUSEKEEPING','PEST_CONTROL','INTERIOR_PAINTING')),
    "scheduledDate" DATETIME NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "supervisorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK ("status" IN ('ASSIGNED','ON_THE_WAY','STARTED','COMPLETED')),
    "onTheWayAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "jobValue" REAL NOT NULL,
    "notes" TEXT,
    "customerSignatureUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_scheduledDate_idx" ON "Job"("scheduledDate");
CREATE INDEX "Job_area_idx" ON "Job"("area");

-- ── JobAssignment ───────────────────────────────────────────────────────
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobAssignment_jobId_staffId_key" ON "JobAssignment"("jobId", "staffId");
CREATE INDEX "JobAssignment_staffId_idx" ON "JobAssignment"("staffId");

-- ── Photo ───────────────────────────────────────────────────────────────
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('BEFORE','AFTER')),
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Photo_jobId_type_idx" ON "Photo"("jobId", "type");

-- ── Certificate ─────────────────────────────────────────────────────────
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issuedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT NOT NULL,
    "serviceSummary" TEXT NOT NULL,
    "supervisorName" TEXT,
    "signatureUrl" TEXT,
    "pdfUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Certificate_jobId_key" ON "Certificate"("jobId");
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- ── Payment ─────────────────────────────────────────────────────────────
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "jobId" TEXT,
    "leadId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientMobile" TEXT,
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "paidDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','DUE_SOON','OVERDUE','PAID')),
    "mybillbookInvoiceNo" TEXT,
    "lastReminderAt" DATETIME,
    "lastReminderChannel" TEXT CHECK ("lastReminderChannel" IS NULL OR "lastReminderChannel" IN ('WHATSAPP','EMAIL','CALL')),
    "recordedById" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_dueDate_idx" ON "Payment"("dueDate");

-- ── Expense ─────────────────────────────────────────────────────────────
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL CHECK ("category" IN ('CHEMICALS','FUEL','EQUIPMENT','STAFF_ADVANCE','MISCELLANEOUS')),
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidTo" TEXT,
    "jobId" TEXT,
    "staffId" TEXT,
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- ── ActivityLog ─────────────────────────────────────────────────────────
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "jobId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ActivityLog_leadId_idx" ON "ActivityLog"("leadId");
CREATE INDEX "ActivityLog_jobId_idx" ON "ActivityLog"("jobId");

-- ── CompanySettings (singleton) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Sahara Cleaning Services',
    "phone" TEXT NOT NULL DEFAULT '7083347130',
    "email" TEXT NOT NULL DEFAULT 'contact@saharacleaningservices.com',
    "address" TEXT NOT NULL DEFAULT 'Opp. South Gate, Magarpatta City, Hadapsar, Pune.',
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO "CompanySettings" ("id") VALUES ('default');
