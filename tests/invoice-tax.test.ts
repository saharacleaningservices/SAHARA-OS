// Run: npx tsx --test tests/invoice-tax.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { computeInvoiceTotals, discountAmount, isValidGstin } from "../src/lib/invoice-tax";

test("B2C default: no GST lines, total = subtotal - discount", () => {
  const t = computeInvoiceTotals({ subtotal: 4999, discount: { mode: "FLAT", value: 500 }, advancePaid: 1000 });
  assert.deepEqual([t.discount, t.gst, t.cgst, t.sgst, t.total, t.balanceDue], [500, 0, 0, 0, 4499, 3499]);
});

test("B2B: 18% GST on the discounted amount, split CGST 9% + SGST 9%", () => {
  const t = computeInvoiceTotals({ subtotal: 10000, discount: { mode: "PERCENT", value: 10 }, gstEnabled: true, advancePaid: 2000 });
  assert.deepEqual([t.discount, t.taxable, t.cgst, t.sgst, t.gst, t.total, t.balanceDue], [1000, 9000, 810, 810, 1620, 10620, 8620]);
});

test("discount is clamped: never negative, never above the subtotal, percent capped at 100", () => {
  assert.equal(discountAmount(1000, { mode: "FLAT", value: -50 }), 0);
  assert.equal(discountAmount(1000, { mode: "FLAT", value: 5000 }), 1000);
  assert.equal(discountAmount(1000, { mode: "PERCENT", value: 250 }), 1000);
  assert.equal(discountAmount(0, { mode: "PERCENT", value: 10 }), 0);
  assert.equal(discountAmount(1000, null), 0);
});

test("amounts are exact to the paisa and balance never goes negative", () => {
  const t = computeInvoiceTotals({ subtotal: 3333.33, discount: { mode: "PERCENT", value: 7.5 }, gstEnabled: true, advancePaid: 99999 });
  assert.equal(t.gst, Math.round((t.cgst + t.sgst) * 100) / 100);
  assert.equal(t.total, Math.round((t.taxable + t.gst) * 100) / 100);
  assert.equal(t.balanceDue, 0);
});

test("GSTIN format check", () => {
  assert.ok(isValidGstin("27AABCU9603R1ZM"));
  assert.ok(!isValidGstin("27AABCU9603R1"));
  assert.ok(!isValidGstin(null));
});
