import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOutstandingBalance } from "../src/server/job-review";

test("a balance still due blocks the review request", () => {
  assert.equal(hasOutstandingBalance([{ status: "PENDING", amount: 6000, paidAmount: 1200 }]), true);
  assert.equal(hasOutstandingBalance([{ status: "PAID", amount: 1200, paidAmount: 1200 }, { status: "OVERDUE", amount: 4800, paidAmount: 0 }]), true);
});

test("fully paid payments (or none at all) allow the review request", () => {
  assert.equal(hasOutstandingBalance([{ status: "PAID", amount: 6000, paidAmount: 6000 }]), false);
  assert.equal(hasOutstandingBalance([{ status: "PENDING", amount: 6000, paidAmount: 6000 }]), false); // paid in full, status not yet flipped
  assert.equal(hasOutstandingBalance([]), false);
});
