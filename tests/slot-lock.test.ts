// withSlotLock: same-key work runs strictly one at a time (no overlap), other keys stay parallel.
import test from "node:test";
import assert from "node:assert/strict";
import { slotLockKey, withSlotLock } from "../src/lib/slot-lock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("same date: critical sections never overlap and run in arrival order", async () => {
  let active = 0, maxActive = 0;
  const order: number[] = [];
  await Promise.all([1, 2, 3, 4].map((n) => withSlotLock("book:2026-11-06", async () => {
    active++; maxActive = Math.max(maxActive, active);
    await sleep(15 - n * 2);
    order.push(n); active--;
  })));
  assert.equal(maxActive, 1);
  assert.deepEqual(order, [1, 2, 3, 4]);
});

test("different dates run in parallel", async () => {
  let active = 0, maxActive = 0;
  await Promise.all(["2026-11-06", "2026-11-07"].map((d) => withSlotLock(`book:${d}`, async () => {
    active++; maxActive = Math.max(maxActive, active); await sleep(20); active--;
  })));
  assert.equal(maxActive, 2);
});

test("a failing booking releases the lock for the next one", async () => {
  await assert.rejects(withSlotLock("k", async () => { throw new Error("boom"); }));
  assert.equal(await withSlotLock("k", async () => "ok"), "ok");
});

test("slotLockKey reads the service date safely", () => {
  assert.equal(slotLockKey({ serviceDate: "2026-11-07T00:00:00+05:30" }), "2026-11-07");
  assert.equal(slotLockKey({}), null);
  assert.equal(slotLockKey(null), null);
  assert.equal(slotLockKey({ serviceDate: 5 }), null);
});
