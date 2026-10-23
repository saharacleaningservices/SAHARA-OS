// Party ledger (owner brief 2026-10-24, item 3): debit / credit / running balance, no double counting, item-wise report, Excel export, tabs.
// Run: npx tsx --test tests/party-ledger.test.ts   Synthetic data; throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { aggregateItems, buildLedger } from "../src/lib/party-ledger";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-pl-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let srv: typeof import("../src/server/party-ledger");
let exp: typeof import("../src/server/party-ledger-export");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  srv = await import("../src/server/party-ledger");
  exp = await import("../src/server/party-ledger-export");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const d = (s: string) => new Date(`${s}T06:30:00Z`);

test("pure: oldest first, sale before its receipt on the same day, running balance, advance shows as negative, totals", () => {
  const l = buildLedger([
    { date: d("2026-10-05"), kind: "Payment In", ref: "P1", debit: 0, credit: 2000 },
    { date: d("2026-10-05"), kind: "Sales Invoice", ref: "I1", debit: 5000, credit: 0 },
    { date: d("2026-09-01"), kind: "Payment In", ref: "ADV", debit: 0, credit: 1000 }, // advance before any invoice
    { date: d("2026-10-06"), kind: "Empty", ref: "X", debit: 0, credit: 0 },
  ]);
  assert.deepEqual(l.rows.map((r) => [r.ref, r.balance]), [["ADV", -1000], ["I1", 4000], ["P1", 2000]]);
  assert.deepEqual([l.billed, l.received, l.balance], [5000, 3000, 2000]);
  assert.deepEqual(buildLedger([]), { rows: [], billed: 0, received: 0, balance: 0 });
});

test("pure: item-wise report merges the same service across invoices (case / spacing ignored), biggest first", () => {
  const rows = aggregateItems([
    { name: "Sofa Cleaning", qty: 5, amount: 1000, date: d("2026-01-01"), doc: "A" },
    { name: "  sofa   cleaning ", qty: 3, amount: 600, date: d("2026-03-01"), doc: "B" },
    { name: "Full House Deep Cleaning", qty: 1, amount: 7500, date: d("2026-02-01"), doc: "A" },
    { name: "", qty: 1, amount: 99, date: d("2026-02-01"), doc: "A" },
  ]);
  assert.deepEqual(rows.map((r) => [r.item, r.qty, r.amount, r.documents]), [["Full House Deep Cleaning", 1, 7500, 1], ["Sofa Cleaning", 8, 1600, 2]]);
  assert.equal(rows[1].lastDate.toISOString().slice(0, 10), "2026-03-01");
});

test("gathered ledger: CRM invoice + payments, imported MyBillBook invoice (with its paid part), credit note; an imported copy of a CRM-invoiced job is not counted twice; other parties are excluded", async () => {
  const cust = await db.customer.create({ data: { name: "Acme Traders", mobile: "9811111111", customerNumber: "C-1" } });
  const other = await db.customer.create({ data: { name: "Other", mobile: "9822222222", customerNumber: "C-2" } });
  const job = await db.job.create({ data: { jobNumber: "PL-J1", customerName: "Acme Traders", customerMobile: "+91 98111 11111", address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: d("2026-10-01"), scheduledTime: "10 AM", jobValue: 10000, status: "COMPLETED" } as never });
  await db.invoice.create({ data: { invoiceNumber: "SC/SL/26-27/0100", jobId: job.id, customerName: "Acme Traders", customerMobile: "9811111111", lineItems: JSON.stringify([{ name: "Full House Deep Cleaning", amount: 8000 }, { name: "Sofa Cleaning", amount: 2000 }]), subTotal: 10000, totalAmount: 10000, createdAt: d("2026-10-02") } as never });
  await db.payment.create({ data: { jobId: job.id, clientName: "Acme Traders", clientMobile: "9811111111", invoiceNumber: "PAY-1", amount: 10000, paidAmount: 4000, dueDate: d("2026-10-01"), paidDate: d("2026-10-03"), status: "PENDING", mode: "UPI" } as never });
  await db.payment.create({ data: { clientName: "Other", clientMobile: "9822222222", invoiceNumber: "PAY-X", amount: 500, paidAmount: 500, dueDate: d("2026-10-01"), paidDate: d("2026-10-03"), status: "PAID" } as never });
  const detail = JSON.stringify({ invoiceNumber: "H1", invoiceDate: "2025-05-01", partyName: "Acme", partyMobile: null, partyAddress: null, partyGstin: null, lines: [{ name: "Office Deep Cleaning", qty: 1, rate: 3000, amount: 3000, description: null, gstPercent: 0 }], total: 3000, gstAmount: 0, taxableAmount: 3000, remaining: 1000, discount: 0, paymentMode: null, notes: null });
  await db.mybillbookInvoice.create({ data: { invoiceNo: "H1", invoiceKey: "i/h1", invoiceDate: d("2025-05-01"), contactName: "Acme", amount: 3000, remaining: 1000, status: "Unpaid", invoiceLink: "https://mybillbook.in/i/h1", customerId: cust.id, detailJson: detail, detailStatus: "DONE", serviceName: "Office Deep Cleaning" } });
  await db.mybillbookInvoice.create({ data: { invoiceNo: "H2", invoiceKey: "i/h2", invoiceDate: d("2026-10-02"), contactName: "Acme", amount: 10000, remaining: 0, status: "Paid", invoiceLink: "https://mybillbook.in/i/h2", customerId: cust.id, jobId: job.id } }); // the same sale as the CRM invoice
  await db.mybillbookInvoice.create({ data: { invoiceNo: "H9", invoiceKey: "i/h9", invoiceDate: d("2025-06-01"), contactName: "Other", amount: 777, remaining: 0, status: "Paid", invoiceLink: "https://mybillbook.in/i/h9", customerId: other.id } });
  await db.voucher.create({ data: { type: "CREDIT_NOTE", number: "CN/26-27/0001", voucherDate: d("2026-10-10"), partyName: "Acme Traders", customerId: cust.id, refNumber: "SC/SL/26-27/0100", lineItems: "[]", subTotal: 500, totalAmount: 500 } });

  const l = await srv.getPartyLedger("9811111111");
  assert.equal(l.name, "Acme Traders");
  assert.deepEqual(l.ledger.rows.map((r) => [r.kind, r.ref, r.debit, r.credit]), [
    ["MyBillBook Invoice", "H1", 3000, 0],
    ["MyBillBook Payment", "H1", 0, 2000],
    ["Sales Invoice", "SC/SL/26-27/0100", 10000, 0],
    ["Payment In", "PAY-1", 0, 4000],
    ["Credit Note", "CN/26-27/0001", 0, 500],
  ]);
  assert.deepEqual([l.ledger.billed, l.ledger.received, l.ledger.balance], [13000, 6500, 6500]);
  assert.deepEqual(l.items.map((i) => [i.item, i.amount]), [["Full House Deep Cleaning", 8000], ["Office Deep Cleaning", 3000], ["Sofa Cleaning", 2000]]);
  assert.deepEqual((await srv.getPartyLedger("+91 9822222222")).ledger.rows.map((r) => r.ref).sort(), ["H9", "H9", "PAY-X"]); // the imported invoice and its paid part
});

test("Excel statement: Ledger, Summary and Item-wise sheets carry the same numbers", async () => {
  const l = await srv.getPartyLedger("9811111111");
  const { buffer, filename } = exp.ledgerWorkbook(l);
  assert.equal(filename, "Ledger-Acme-Traders-9811111111.xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(wb.SheetNames, ["Ledger", "Summary", "Item-wise"]);
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets.Ledger);
  assert.equal(rows.length, 5);
  assert.equal(rows[rows.length - 1].Balance, 6500);
  assert.deepEqual(XLSX.utils.sheet_to_json<Record<string, number>>(wb.Sheets.Summary)[0]["Total billed"], 13000);
});

test("page + route: four tabs, export buttons, To Collect / To Pay cards; the download route is Admin / Accounts only", () => {
  const page = readFileSync("src/app/(app)/customers/[mobile]/page.tsx", "utf8");
  for (const t of ["Transactions", "Profile", "Ledger Statement", "Item-wise Report"]) assert.ok(page.includes(t), t);
  assert.ok(page.includes("format=pdf") && page.includes("format=xlsx"));
  const list = readFileSync("src/app/(app)/customers/page.tsx", "utf8");
  assert.ok(list.includes("To Collect") && list.includes("To Pay") && list.includes('title="Parties"'));
  const route = readFileSync("src/app/api/customers/[mobile]/ledger/route.ts", "utf8");
  assert.match(route, /\["ADMIN", "ACCOUNTS"\]\.includes\(session\.role\)/);
});
