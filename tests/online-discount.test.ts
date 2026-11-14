import { test } from "node:test";
import assert from "node:assert/strict";
import { onlineBookingDiscount, ONLINE_BOOKING_DISCOUNT_PERCENT } from "../src/lib/online-discount";

test("flat 5% online booking discount, rounded to the rupee, identical to the website rule", () => {
  assert.equal(ONLINE_BOOKING_DISCOUNT_PERCENT, 5);
  assert.deepEqual(onlineBookingDiscount(3999), { gross: 3999, discount: 200, net: 3799 });
  assert.deepEqual(onlineBookingDiscount(4999 + 599), { gross: 5598, discount: 280, net: 5318 });
  assert.deepEqual(onlineBookingDiscount(899), { gross: 899, discount: 45, net: 854 });
  assert.deepEqual(onlineBookingDiscount(0), { gross: 0, discount: 0, net: 0 });
});

test("the minimum order is checked on the full price, before the discount", async () => {
  const { readFileSync } = await import("node:fs");
  const core = readFileSync(new URL("../src/server/public-booking-core.ts", import.meta.url), "utf8");
  const mov = core.indexOf("estimated < minOrder");
  const disc = core.indexOf("onlineBookingDiscount(estimated)");
  assert.ok(mov > 0 && disc > mov, "MOV check comes before the discount is applied");
});
