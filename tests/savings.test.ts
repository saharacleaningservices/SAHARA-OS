import { test } from "node:test";
import assert from "node:assert/strict";
import { savingsOf, savingsLabel } from "../src/lib/savings";

test("owner's six festival examples calculate the stated saving and percentage", () => {
  const rows: [number, number, number, number][] = [
    [6999, 5499, 1500, 21],
    [7999, 6499, 1500, 19], // 18.75% rounds to 19 (the brief said 18)
    [8499, 6999, 1500, 18],
    [9499, 7999, 1500, 16],
    [9999, 7999, 2000, 20],
    [11999, 9499, 2500, 21],
  ];
  for (const [mrp, price, save, pct] of rows) assert.deepEqual(savingsOf(mrp, price), { save, pct });
});

test("no saving unless MRP is genuinely above the price", () => {
  assert.equal(savingsOf(5000, 5000), null);
  assert.equal(savingsOf(4000, 5000), null);
  assert.equal(savingsOf(undefined, 5000), null);
  assert.equal(savingsOf(6000, null), null);
});

test("label format", () => {
  assert.equal(savingsLabel({ save: 1500, pct: 21 }), "You Save ₹1,500 (21% OFF)");
});

import { strikePrice } from "../src/lib/savings";

test("festival: strike only a genuinely higher regular price, never an MRP", () => {
  assert.equal(strikePrice({ festival: 4999, regular: 5499, mrp: 9999 }), 5499);
  assert.equal(strikePrice({ festival: 5499, regular: 4499, mrp: 6999 }), null); // festival above regular → clean price, no anchor
  assert.equal(strikePrice({ festival: 5499, regular: 5499 }), null);
  assert.equal(strikePrice({ festival: 5499, regular: null }), null);
});

test("outside a festival the owner MRP applies only above the regular price", () => {
  assert.equal(strikePrice({ festival: null, regular: 5499, mrp: 5999 }), 5999);
  assert.equal(strikePrice({ festival: null, regular: 5499, mrp: 5499 }), null);
  assert.equal(strikePrice({ festival: null, regular: 5499 }), null);
});
