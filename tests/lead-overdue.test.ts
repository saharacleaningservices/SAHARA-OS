import { test } from "node:test";
import assert from "node:assert/strict";
import { isLeadPaid, showOverdue } from "../src/lib/lead-overdue";

test("completed or paid leads are never Overdue", () => {
  assert.equal(showOverdue("COMPLETED", false), false);
  assert.equal(showOverdue("JOB_SCHEDULED", true), false);
  assert.equal(showOverdue("JOB_SCHEDULED", false), true);
  assert.equal(showOverdue("NEW", undefined), true);
});
test("paid means every payment is PAID", () => {
  assert.equal(isLeadPaid([{ status: "PAID" }, { status: "PAID" }]), true);
  assert.equal(isLeadPaid([{ status: "PAID" }, { status: "PENDING" }]), false);
  assert.equal(isLeadPaid([]), false);
  assert.equal(isLeadPaid(undefined), false);
});
