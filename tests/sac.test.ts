import { test } from "node:test";
import assert from "node:assert/strict";
import { gstDefaultFor, sacFor } from "../src/lib/sac";

test("SAC per service type", () => {
  assert.equal(sacFor("HOME_DEEP_CLEANING"), "998533");
  assert.equal(sacFor("COMMERCIAL_CLEANING"), "998533");
  assert.equal(sacFor("PEST_CONTROL"), "998531");
  assert.equal(sacFor("INTERIOR_PAINTING"), "995471");
  assert.equal(sacFor(null), "998533");
});
test("SAC from free-text line names", () => {
  assert.equal(sacFor("Termite treatment 2BHK"), "998531");
  assert.equal(sacFor("Interior Painting - Royale"), "995471");
  assert.equal(sacFor("Sofa shampoo"), "998533");
});
test("B2B parties default to 18% GST, B2C does not", () => {
  assert.equal(gstDefaultFor({ segment: "B2B" }), true);
  assert.equal(gstDefaultFor({ segment: "BOTH" }), true);
  assert.equal(gstDefaultFor({ segment: "B2C" }), false);
  assert.equal(gstDefaultFor({ segment: "B2C", gstin: "27AAPFU0939F1ZV" }), true);
  assert.equal(gstDefaultFor({ segment: null, gstin: "bad" }), false);
  assert.equal(gstDefaultFor(null), false);
});
