import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLakhs } from "../src/lib/utils";
import { matchesSegment } from "../src/lib/customer-segment";

test("segment toggle: BOTH shows under B2B and B2C, unknown only under All", () => {
  assert.equal(matchesSegment("B2B", "B2B"), true);
  assert.equal(matchesSegment("B2C", "B2B"), false);
  assert.equal(matchesSegment("BOTH", "B2B"), true);
  assert.equal(matchesSegment("BOTH", "B2C"), true);
  assert.equal(matchesSegment(null, "B2C"), false);
  assert.equal(matchesSegment(null, "ALL"), true);
});
test("lakhs formatting for summary cards", () => {
  assert.equal(formatLakhs(135300), "₹1.35 L");
  assert.equal(formatLakhs(25587608.66), "₹255.88 L");
  assert.match(formatLakhs(5500), /5,500/);
});
