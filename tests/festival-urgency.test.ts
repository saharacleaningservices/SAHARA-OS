import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMAND_WINDOW, festivalUrgency, shortDate } from "../src/lib/festival-urgency";

test("shortDate formats a calendar date", () => {
  assert.equal(shortDate("2026-10-21"), "21 Oct");
  assert.equal(shortDate("2026-11-08"), "8 Nov");
});

test("the demand window is 21 Oct – 8 Nov 2026", () => {
  assert.deepEqual({ ...DEMAND_WINDOW }, { start: "2026-10-21", end: "2026-11-08" });
  assert.equal(festivalUrgency("2026-10-20")?.label, "21 Oct – 8 Nov");
});

test("shown on the last day, hidden the day after", () => {
  assert.ok(festivalUrgency("2026-11-08"));
  assert.equal(festivalUrgency("2026-11-09"), null);
});

test("the label never contains a slot count or a price figure", () => {
  assert.match(festivalUrgency("2026-10-25")!.label, /^\d{1,2} [A-Z][a-z]{2} – \d{1,2} [A-Z][a-z]{2}$/);
});
