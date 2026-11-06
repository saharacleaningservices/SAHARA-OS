import { test } from "node:test";
import assert from "node:assert/strict";
import { monthMatrixDates, slotIndexOf, startHourOf } from "../src/lib/slot-matrix";

test("job times map to the right 2-hour window", () => {
  assert.equal(slotIndexOf("8:00 – 10:00 AM"), 0);
  assert.equal(slotIndexOf("10:00 AM"), 1);
  assert.equal(slotIndexOf("11:30 AM"), 1);
  assert.equal(slotIndexOf("12:00 – 2:00 PM"), 2);
  assert.equal(slotIndexOf("2:00 PM"), 3);
  assert.equal(slotIndexOf("1:00 – 3:00"), 2);
  assert.equal(slotIndexOf("4:00 – 6:00 PM"), 4);
});
test("flexible, unknown and out-of-hours times are -1", () => {
  assert.equal(slotIndexOf("Flexible"), -1);
  assert.equal(slotIndexOf(""), -1);
  assert.equal(slotIndexOf(null), -1);
  assert.equal(slotIndexOf("7:00 PM"), -1);
  assert.equal(startHourOf("12:00 AM"), 0);
});
test("matrix is 35 days starting on the Monday of this week", () => {
  const d = monthMatrixDates("2026-11-06"); // a Friday
  assert.equal(d.length, 35);
  assert.equal(d[0], "2026-11-02");
  assert.equal(d[4], "2026-11-06");
  assert.equal(d[34], "2026-12-06");
  assert.equal(monthMatrixDates("2026-11-02")[0], "2026-11-02");
  assert.equal(monthMatrixDates("2026-11-08")[0], "2026-11-02"); // Sunday belongs to the week that started Monday
});
