import { test } from "node:test";
import assert from "node:assert/strict";
import { isClosable } from "../src/server/past-jobs-cleanup";
import { backoffMs, isConnectError, isRetryableStatus, MAX_ATTEMPTS } from "../src/lib/send-retry";

const job = (status: string, date: string, deleted = false) => ({ status, deleted, scheduledDate: new Date(`${date}T00:00:00Z`) });
const paid = { status: "PAID", amount: 6000, paidAmount: 6000 };

test("only past-dated, open, fully-paid jobs are closable", () => {
  assert.equal(isClosable(job("ASSIGNED", "2026-10-10"), [paid], "2026-10-21"), true);
  assert.equal(isClosable(job("STARTED", "2026-10-20"), [paid, { status: "PENDING", amount: 1000, paidAmount: 1000 }], "2026-10-21"), true);
  assert.equal(isClosable(job("ASSIGNED", "2026-10-21"), [paid], "2026-10-21"), false, "today is not past");
  assert.equal(isClosable(job("ASSIGNED", "2026-10-25"), [paid], "2026-10-21"), false);
  assert.equal(isClosable(job("COMPLETED", "2026-10-10"), [paid], "2026-10-21"), false);
  assert.equal(isClosable(job("CANCELLED", "2026-10-10"), [paid], "2026-10-21"), false);
  assert.equal(isClosable(job("POSTPONED", "2026-10-10"), [paid], "2026-10-21"), false);
  assert.equal(isClosable(job("ASSIGNED", "2026-10-10", true), [paid], "2026-10-21"), false);
});

test("a balance or a missing payment record blocks closing", () => {
  assert.equal(isClosable(job("ASSIGNED", "2026-10-10"), [{ status: "PENDING", amount: 6000, paidAmount: 5000 }], "2026-10-21"), false);
  assert.equal(isClosable(job("ASSIGNED", "2026-10-10"), [paid, { status: "OVERDUE", amount: 500, paidAmount: 0 }], "2026-10-21"), false);
  assert.equal(isClosable(job("ASSIGNED", "2026-10-10"), [], "2026-10-21"), false);
});

test("retry only where Meta clearly did not accept the message", () => {
  for (const s of [429, 502, 503, 504]) assert.equal(isRetryableStatus(s), true);
  for (const s of [200, 400, 401, 403, 404, 500]) assert.equal(isRetryableStatus(s), false, `${s}`);
  const abort = Object.assign(new Error("t"), { name: "TimeoutError" });
  assert.equal(isConnectError(abort), false, "a timeout may have been delivered");
  assert.equal(isConnectError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })), true);
  assert.equal(isConnectError(new Error("other")), false);
  assert.equal(MAX_ATTEMPTS, 3);
});

test("backoff grows and honours a short Retry-After", () => {
  assert.equal(backoffMs(1), 500);
  assert.equal(backoffMs(2), 1500);
  assert.equal(backoffMs(1, "2"), 2000);
  assert.equal(backoffMs(1, "60"), 3000);
});
