// Customers that exist only in MyBillBook get a CRM profile (owner brief 2026-10-23/25). Run: npx tsx --test tests/mybillbook-create-customers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-mcc-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let srv: typeof import("../src/server/mybillbook-import");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  srv = await import("../src/server/mybillbook-import");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const inv = (n: string, name: string, mobile: string | null, status = "UNMATCHED") =>
  db.mybillbookInvoice.create({ data: { invoiceNo: n, invoiceKey: `i/${n}`, invoiceDate: new Date("2025-05-01T06:30:00Z"), contactName: name, amount: 1000, remaining: 0, status: "Paid", invoiceLink: `https://mybillbook.in/i/${n}`, matchStatus: status, partyMobile: mobile } });

test("preview counts, apply creates profiles / joins existing ones, no-mobile rows are never guessed, second run does nothing", async () => {
  await db.customer.create({ data: { name: "Already Here", mobile: "9811100001", customerNumber: "C-EX" } });
  await inv("A1", "New Person", "9811100002");
  await inv("A2", "New Person (again)", "+91 98111 00002"); // same person, second invoice
  await inv("A3", "Already Here Pvt", "9811100001", "REVIEW"); // joins the existing customer
  await inv("A4", "No Phone Traders", null); // never guessed
  await inv("A5", "Bad Phone", "12345"); // not a valid mobile

  const dry = await srv.createCustomersFromUnattached({ dryRun: true });
  assert.deepEqual([dry.unattached, dry.noMobile, dry.attachedToExisting, dry.created, dry.invoicesAttached], [5, 2, 1, 1, 3]);
  assert.equal(await db.customer.count(), 1, "a preview writes nothing");

  const done = await srv.createCustomersFromUnattached({ dryRun: false });
  assert.deepEqual([done.created, done.attachedToExisting, done.invoicesAttached], [1, 1, 3]);
  const made = await db.customer.findUniqueOrThrow({ where: { mobile: "9811100002" } });
  assert.equal(made.name, "New Person");
  assert.match(String(made.customerNumber), /^CUST-/);
  const rows = await db.mybillbookInvoice.findMany({ orderBy: { invoiceNo: "asc" } });
  assert.deepEqual(rows.map((r) => [r.invoiceNo, r.matchStatus, r.customerId ? "linked" : "-"]), [["A1", "MATCHED", "linked"], ["A2", "MATCHED", "linked"], ["A3", "MATCHED", "linked"], ["A4", "UNMATCHED", "-"], ["A5", "UNMATCHED", "-"]]);
  assert.equal(rows[0].customerId, rows[1].customerId);

  const again = await srv.createCustomersFromUnattached({ dryRun: false });
  assert.deepEqual([again.created, again.invoicesAttached, again.noMobile], [0, 0, 2]);
});
