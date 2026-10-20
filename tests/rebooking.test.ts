import { test } from "node:test";
import assert from "node:assert/strict";
import { rebookWindow, rebookMarker, rebookingEnabled, REBOOK_MONTHS } from "../src/server/rebooking";

test("3 and 6 months are the reminder intervals", () => {
  assert.deepEqual([...REBOOK_MONTHS], [3, 6]);
  assert.equal(rebookMarker(3), "REBOOK_3M");
});

test("window ends exactly N months ago and catches up 7 days", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  const w3 = rebookWindow(now, 3);
  assert.equal(w3.to.toISOString().slice(0, 10), "2026-07-21");
  assert.equal(w3.from.toISOString().slice(0, 10), "2026-07-14");
  const w6 = rebookWindow(now, 6);
  assert.equal(w6.to.toISOString().slice(0, 10), "2026-04-21");
});

test("switched off unless REBOOKING_REMINDERS=on", () => {
  delete process.env.REBOOKING_REMINDERS;
  assert.equal(rebookingEnabled(), false);
  process.env.REBOOKING_REMINDERS = "on";
  assert.equal(rebookingEnabled(), true);
  delete process.env.REBOOKING_REMINDERS;
});
