// Sales Dashboard figures + Quick Search Past History merge (owner 2026-10-25). Pure functions, no DB. Run: npm run test:salessearch
import test from "node:test";
import assert from "node:assert/strict";
import { fyStart, splitInvoices } from "../src/server/sales-dashboard";
import { mergeHistory } from "../src/server/customer-quick-history";

const d = (s: string) => new Date(s);

test("fyStart: Indian financial year begins 1 April", () => {
  assert.equal(fyStart(d("2026-10-25")).getFullYear(), 2026);
  assert.equal(fyStart(d("2026-10-25")).getMonth(), 3);
  assert.equal(fyStart(d("2027-02-10")).getFullYear(), 2026);
});

test("splitInvoices: CRM + MyBillBook counted once, paid vs pending by payments received", () => {
  const crm = [
    { id: "a", invoiceNumber: "SC/SL/26-27/1500", customerName: "Asha", customerMobile: "+91 90000 00001", totalAmount: 8000, status: "ISSUED", createdAt: d("2026-10-01"), received: 8000, linked: true },
    { id: "b", invoiceNumber: "SC/SL/26-27/1501", customerName: "Ravi", customerMobile: null, totalAmount: 5000, status: "ISSUED", createdAt: d("2026-10-02"), received: 1000, linked: true },
    { id: "c", invoiceNumber: "WALK-1", customerName: "Walk-in", customerMobile: null, totalAmount: 2000, status: "PAID", createdAt: d("2025-12-02"), received: 0, linked: false },
  ];
  const mbb = [
    { invoiceNo: "sc/sl/26-27/1500", contactName: "Asha", invoiceDate: d("2026-10-01"), amount: 8000, remaining: 0, customerMobile: "9000000001" }, // same bill as CRM "a"
    { invoiceNo: "SC/SL/25-26/700", contactName: "Old Co", invoiceDate: d("2025-06-01"), amount: 12000, remaining: 4000, customerMobile: null },
    { invoiceNo: "SC/SL/25-26/701", contactName: "Paid Co", invoiceDate: d("2025-07-01"), amount: 3000, remaining: 0, customerMobile: "9000000009" },
  ];
  const s = splitInvoices(crm, mbb, d("2026-04-01"));
  assert.equal(s.invoices, 5, "duplicate MyBillBook copy of a CRM invoice is dropped");
  assert.equal(s.allTime, 8000 + 5000 + 2000 + 12000 + 3000);
  assert.equal(s.fy, 13000);
  assert.equal(s.paidCount, 3);
  assert.equal(s.paidAmount, 8000 + 2000 + 3000);
  assert.deepEqual(s.pendingRows.map((r) => [r.number, r.balance]), [["SC/SL/26-27/1501", 4000], ["SC/SL/25-26/700", 4000]].sort((a, b) => (b[1] as number) - (a[1] as number)));
  assert.equal(s.pendingRows.find((r) => r.number === "SC/SL/25-26/700")?.href, "/customers/mybillbook-import");
});

test("mergeHistory: newest first, same invoice number counted once, total billed adds up", () => {
  const m = mergeHistory(
    [
      { date: d("2026-09-10"), service: "Home Deep Cleaning · Platinum", amount: 7000, ref: "JOB-1", invoiceNumber: "SC/SL/26-27/1400" },
      { date: d("2026-03-01"), service: "Sofa Cleaning", amount: 1500, ref: "JOB-2", invoiceNumber: null },
    ],
    [
      { date: d("2026-09-10"), service: "Full House Cleaning", amount: 7000, invoiceNo: "SC/SL/26-27/1400" },
      { date: d("2026-10-01"), service: null, amount: 2000, invoiceNo: "SC/SL/26-27/1450" },
      { date: d("2024-01-01"), service: "Bathroom", amount: 900, invoiceNo: "SC&PS100" },
    ],
  );
  assert.deepEqual(m.rows.map((r) => r.ref), ["SC/SL/26-27/1450", "SC/SL/26-27/1400", "JOB-2", "SC&PS100"]);
  assert.equal(m.rows[0].service, "Service (MyBillBook)");
  assert.equal(m.total, 2000 + 7000 + 1500 + 900);
});
