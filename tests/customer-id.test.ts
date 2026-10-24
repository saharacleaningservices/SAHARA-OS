// Customer ID (CUST-####): boot migration, assignment on create, display and the locked booking profile. Run: npm run test:custid
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";

const read = (f: string) => readFileSync(f, "utf8");

test("schema + db-setup: nullable unique customerNumber, added idempotently", () => {
  assert.match(read("prisma/schema.prisma"), /customerNumber\s+String\?\s+@unique/);
  const setup = read("scripts/db-setup.mjs");
  assert.ok(setup.includes(`ALTER TABLE "Customer" ADD COLUMN "customerNumber" TEXT`));
  assert.ok(setup.includes(`CREATE UNIQUE INDEX IF NOT EXISTS "Customer_customerNumber_key"`));
  assert.ok(setup.includes(`WHERE "customerNumber" IS NULL ORDER BY "createdAt" ASC`), "only missing rows, in creation order");
  assert.ok(setup.includes(`INSERT OR IGNORE INTO "Customer"`), "master rows only added, never overwritten");
});

test("db-setup on a fresh database twice: no errors, every contact numbered once, re-run changes nothing", () => {
  const dir = path.join(os.tmpdir(), `custid-${process.pid}`);
  const file = path.join(dir, "t.db");
  rmSync(dir, { recursive: true, force: true });
  const env = { ...process.env, DATABASE_URL: `file:${file}` };
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], { env, stdio: "pipe" });
  const db = new Database(file);
  const now = new Date().toISOString();
  const lead = db.prepare(`INSERT INTO "Lead" ("id","leadNumber","name","mobile","area","service","source","stage","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)`);
  lead.run("l1", "LD-2026-0001", "Asha", "+91 90000 00001", "Kharadi", "HOME_DEEP_CLEANING", "WEBSITE", "NEW", "2026-01-01T00:00:00.000+00:00", now);
  lead.run("l2", "LD-2026-0002", "Asha K", "9000000001", "Kharadi", "HOME_DEEP_CLEANING", "WEBSITE", "NEW", "2026-02-01T00:00:00.000+00:00", now);
  lead.run("l3", "LD-2026-0003", "Ravi", "9000000002", "Baner", "HOME_DEEP_CLEANING", "WEBSITE", "NEW", "2026-03-01T00:00:00.000+00:00", now);
  db.prepare(`INSERT INTO "Customer" ("id","name","mobile","customerNumber","createdAt","updatedAt") VALUES ('c0','Old','9000000099','CUST-0007',?,?)`).run(now, now);
  db.close();
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], { env, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/db-setup.mjs"], { env, stdio: "pipe" });
  const d2 = new Database(file, { readonly: true });
  const rows = d2.prepare(`SELECT "mobile","name","customerNumber" FROM "Customer" ORDER BY "customerNumber"`).all() as { mobile: string; name: string; customerNumber: string }[];
  d2.close();
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(rows.map((r) => r.customerNumber), ["CUST-0007", "CUST-0008", "CUST-0009"], "existing number kept; new ones continue after it");
  assert.equal(rows.find((r) => r.mobile === "9000000001")?.name, "Asha K", "one contact per normalized mobile, latest name");
  assert.ok(!existsSync(file));
});

test("new customers get a number on create (retry on a clash); IDs shown on lists, drawer and PDFs", () => {
  const cdb = read("src/server/customer-db.ts");
  assert.ok(cdb.includes("createWithCustomerNumber") && cdb.includes(`e.code === "P2002"`));
  assert.ok(cdb.includes("if (!existing.customerNumber) patch.customerNumber"));
  assert.ok(read("src/server/actions/import.ts").includes("createWithCustomerNumber"));
  // Owner ID rule 2026-10-24: quotations carry the Lead ID only and invoices the Job ID only - the Customer ID is no longer printed on either.
  const pdf = read("src/server/document-pdf.ts");
  assert.ok(pdf.includes(`label: "Lead ID"`) && pdf.includes(`label: "Job ID"`) && !pdf.includes(`label: "Customer ID"`));
  assert.ok(read("src/components/jobs/jobs-explorer.tsx").includes("job.customerNumber"));
  assert.ok(read("src/components/leads/leads-explorer.tsx").includes("lead.customerNumber"));
  assert.ok(read("src/components/customers/customers-explorer.tsx").includes("c.customerNumber"));
});

test("locked profile: CRM New Lead locks name/email for a saved contact; public form never looks up a typed number", () => {
  const form = read("src/components/leads/lead-form.tsx");
  assert.ok(form.includes("readOnly={profileLocked}"));
  assert.ok(form.includes("setProfileLocked(false)"), "unlocks when the number changes / Edit is pressed");
  const wizard = read("src/components/public/booking-wizard.tsx");
  assert.ok(!/getRepeatCustomerSummary|customerNumbersByMobile|\/api\/customers/.test(wizard), "no customer lookup from the public page");
  assert.ok(wizard.includes("slice(-4)"), "mobile masked on the quotation link");
});
