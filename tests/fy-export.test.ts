// Financial-year Excel exports (owner 2026-10-23). Run: npx tsx --test tests/fy-export.test.ts
// Synthetic rows only. Throwaway SQLite DB; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { fyLabel, fyOf, fyOptions, fyRange, isFy } from "../src/lib/fy";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-fy-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let fx: typeof import("../src/server/fy-export");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  fx = await import("../src/server/fy-export");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("FY helpers: IST boundaries, labels, options", () => {
  assert.equal(fyOf(new Date("2025-03-31T18:29:00Z")), "2024-25"); // 31 Mar 23:59 IST
  assert.equal(fyOf(new Date("2025-03-31T18:31:00Z")), "2025-26"); // 1 Apr 00:01 IST
  assert.equal(fyOf(new Date("2026-10-23T05:00:00Z")), "2026-27");
  assert.equal(fyRange("2024-25").from.toISOString(), "2024-03-31T18:30:00.000Z");
  assert.equal(fyRange("2024-25").to.toISOString(), "2025-03-31T18:30:00.000Z");
  assert.equal(fyLabel("2024-25"), "FY 24-25");
  assert.deepEqual([isFy("2024-25"), isFy("2024-26"), isFy("x"), isFy(null)], [true, false, false, false]);
  const o = fyOptions(new Date("2026-10-23T05:00:00Z"));
  assert.deepEqual([o[0], o[o.length - 1], o.length], ["2026-27", "2022-23", 5]);
});

const rows = (wb: XLSX.WorkBook, sheet: string) => XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets[sheet]);
const open = (b: Buffer) => XLSX.read(b, { type: "buffer" });

test("Sales / GST / Quotations workbooks cover only the chosen FY and keep every row", async () => {
  const cust = await db.customer.create({ data: { name: "Asha Rao", mobile: "9811111111", customerNumber: "C-1" } });
  const mk = (n: string, date: string, amount: number, remaining: number, extra: Record<string, unknown> = {}) =>
    db.mybillbookInvoice.create({ data: { invoiceNo: n, invoiceKey: `i/${n}`, invoiceDate: new Date(`${date}T06:30:00Z`), contactName: `Name ${n}`, amount, remaining, status: remaining ? "Unpaid" : "Paid", invoiceLink: `https://mybillbook.in/i/${n}`, serviceName: "Deep Cleaning", customerId: cust.id, ...extra } });
  const detail = JSON.stringify({ invoiceNumber: "G1", invoiceDate: "2024-08-01", partyName: "Acme", partyMobile: null, partyAddress: null, partyGstin: "27ABCDE1234F1Z5", lines: [{ name: "Office Cleaning", qty: 1, rate: 1180, amount: 1180, description: null, gstPercent: 18 }], total: 1180, gstAmount: 180, taxableAmount: 1000, remaining: 0, discount: 0, paymentMode: null, notes: null });
  await mk("A1", "2024-04-01", 5000, 0); // first day of FY 24-25
  await mk("A2", "2025-03-31", 3000, 1000); // last day of FY 24-25
  await mk("G1", "2024-08-01", 1180, 0, { detailJson: detail, detailStatus: "DONE" });
  await mk("B1", "2025-04-01", 9999, 0); // FY 25-26 — must not appear
  await mk("Z0", "2024-03-31", 7777, 0); // FY 23-24 — must not appear

  const sales = open((await fx.buildFyWorkbook("2024-25", "sales")).buffer);
  assert.deepEqual(rows(sales, "Sales").map((r) => r["Invoice No"]), ["A1", "G1", "A2"]);
  assert.equal(rows(sales, "Sales").find((r) => r["Invoice No"] === "A2")!.Balance, 1000);
  assert.equal(rows(sales, "Monthly").reduce((s, r) => s + Number(r.Total), 0), 9180);

  const gst = open((await fx.buildFyWorkbook("2024-25", "gst")).buffer);
  const reg = rows(gst, "GST Register");
  assert.equal(reg.length, 1);
  assert.deepEqual([reg[0].GSTIN, reg[0].Taxable, reg[0].CGST, reg[0].SGST, reg[0]["Total GST"]], ["27ABCDE1234F1Z5", 1000, 90, 90, 180]);

  const lead = await db.lead.create({ data: { name: "Ravi", mobile: "9822222222", leadNumber: "L-1", area: "Baner", service: "HOME_DEEP_CLEANING", source: "CALL" } as never });
  await db.quotation.create({ data: { quoteNumber: "Q-1", leadId: lead.id, services: JSON.stringify([{ name: "Sofa Cleaning", amount: 2000 }]), subTotal: 2000, totalAmount: 2000, terms: "t", createdAt: new Date("2024-06-10T06:30:00Z") } });
  await db.quotation.create({ data: { quoteNumber: "Q-2", leadId: lead.id, services: "[]", subTotal: 1, totalAmount: 1, terms: "t", createdAt: new Date("2025-06-10T06:30:00Z") } });
  const q = open((await fx.buildFyWorkbook("2024-25", "quotations")).buffer);
  assert.deepEqual(rows(q, "Quotations").map((r) => [r["Quotation No"], r.Services, r.Total]), [["Q-1", "Sofa Cleaning", 2000]]);

  const empty = open((await fx.buildFyWorkbook("2030-31", "sales")).buffer);
  assert.match(String(rows(empty, "Sales")[0].Note), /No records/);
  assert.equal((await fx.buildFyWorkbook("2024-25", "sales")).filename, "Sahara-Sales-FY-24-25.xlsx");
});
