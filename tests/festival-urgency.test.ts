import { test } from "node:test";
import assert from "node:assert/strict";
import { festivalUrgency, shortDate } from "../src/lib/festival-urgency";
import type { FestivalWindow } from "../src/lib/pricing-master";

const w = (id: string, name: string, start: string, end: string): FestivalWindow => ({ id, name, start, end, prices: {} });
const WINDOWS = [w("a", "Navratri", "2026-10-11", "2026-10-20"), w("b", "Diwali", "2026-10-25", "2026-11-10")];

test("shortDate formats a calendar date", () => {
  assert.equal(shortDate("2026-10-25"), "25 Oct");
  assert.equal(shortDate("2026-11-10"), "10 Nov");
});

test("running campaign spans the earliest start to the latest end", () => {
  const u = festivalUrgency(WINDOWS, "2026-10-15");
  assert.equal(u?.running, true);
  assert.equal(u?.label, "11 Oct – 10 Nov");
});

test("between windows the campaign is still running (gap inside the span)", () => {
  assert.equal(festivalUrgency(WINDOWS, "2026-10-22")?.running, true);
});

test("before the first window it shows the upcoming span, not 'running'", () => {
  const u = festivalUrgency(WINDOWS, "2026-10-01");
  assert.equal(u?.running, false);
  assert.equal(u?.label, "11 Oct – 10 Nov");
});

test("no bar once every window has ended, or when none is configured", () => {
  assert.equal(festivalUrgency(WINDOWS, "2026-11-11"), null);
  assert.equal(festivalUrgency([], "2026-10-20"), null);
});

test("the label never invents slot counts or a price-rise figure", () => {
  const u = festivalUrgency(WINDOWS, "2026-10-22");
  assert.match(u!.label, /^\d{1,2} [A-Z][a-z]{2} – \d{1,2} [A-Z][a-z]{2}$/);
});
