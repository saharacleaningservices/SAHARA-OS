// Lead page "Past Service History & Invoices" (2026-10-22). Run: npm run test:custhistory
// Throwaway SQLite DB (scripts/db-setup.mjs); fake mobiles; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-custhist-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let history: typeof import("../src/server/customer-service-history").getCustomerServiceHistory;
let n = 0;
const job = (mobile: string, extra: Record<string, unknown> = {}) =>
  db.job.create({
    data: { jobNumber: `T-J${++n}`, customerName: "Asha", customerMobile: mobile, address: "x", area: "x", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.UTC(2026, 8, n)), scheduledTime: "10:00 AM", jobValue: 1000 * n, status: "COMPLETED", ...extra } as never,
  });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  history = (await import("../src/server/customer-service-history")).getCustomerServiceHistory;
});
test.after(async () => {
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

test("completed jobs for the same mobile (any format), newest first, with invoices; others excluded", async () => {
  const a = await job("9000000501", { completedAt: new Date(Date.UTC(2026, 8, 1)) });
  const b = await job("+91 90000 00501", { completedAt: new Date(Date.UTC(2026, 9, 1)) });
  await job("9000000501", { status: "CANCELLED" }); // not completed
  await job("9000000501", { deletedAt: new Date() }); // deleted
  await job("9111100501"); // same last 4, different number
  await db.invoice.create({ data: { invoiceNumber: "INV-T-1", jobId: b.id, customerName: "Asha", lineItems: "[]", subTotal: 2500, totalAmount: 2950, status: "PAID" } as never });
  await db.invoice.create({ data: { invoiceNumber: "INV-T-2", jobId: a.id, customerName: "Asha", lineItems: "[]", subTotal: 1, totalAmount: 1, status: "CANCELLED" } as never });

  const h = await history("919000000501");
  assert.equal(h.totalJobs, 2);
  assert.deepEqual(h.rows.map((r) => r.jobId), [b.id, a.id], "newest completed first");
  assert.equal(h.rows[0].invoice?.number, "INV-T-1");
  assert.equal(h.rows[0].amount, 2950, "the invoice total wins over the job value");
  assert.equal(h.rows[1].invoice, null, "a cancelled invoice is not offered for download");
  assert.equal(h.rows[1].amount, a.jobValue);
  assert.equal(h.totalAmount, 2950 + a.jobValue);
});

test("no or invalid mobile gives an empty history", async () => {
  for (const m of [null, "", "12345"]) assert.deepEqual(await history(m), { rows: [], totalJobs: 0, totalAmount: 0 });
});

test("the card is shown only to roles that may see contact AND money (Admin, Accounts)", () => {
  const page = readFileSync("src/app/(app)/leads/[id]/page.tsx", "utf8");
  assert.match(page, /\{showContact && showMoney && <CustomerServiceHistoryCard mobile=\{rawLead\.mobile\} \/>\}/);
});
