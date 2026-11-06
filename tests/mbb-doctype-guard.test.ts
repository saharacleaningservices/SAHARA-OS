import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Since the full-history sync (2026-11-06) MybillbookInvoice also holds quotations, payments-in, expenses, credit
// notes and proformas (docType). Sales totals, receivables, ledgers, GST exports and payment reminders must read
// sales invoices only, or a quotation's amount would count as money due (and could trigger a payment reminder).
const SALES_READERS = [
  "src/server/fy-export.ts",
  "src/server/sales-dashboard.ts",
  "src/server/vouchers.ts",
  "src/server/party-ledger.ts",
  "src/server/actions/customer-actions.ts",
  "src/server/customer-quick-history.ts",
  "src/server/lifecycle-reminders.ts",
];

test("every MyBillBook read in sales / receivable code filters docType SALES_INVOICE", () => {
  for (const f of SALES_READERS) {
    const src = readFileSync(f, "utf8");
    const calls = [...src.matchAll(/db\.mybillbookInvoice\.(findMany|findFirst|aggregate|groupBy)\(\{([\s\S]{0,400})/g)];
    assert.ok(calls.length > 0, `${f} has no MyBillBook read (update this list)`);
    for (const c of calls) assert.match(c[2], /docType: "SALES_INVOICE"/, `${f}: ${c[1]} without the sales-invoice filter`);
  }
});
