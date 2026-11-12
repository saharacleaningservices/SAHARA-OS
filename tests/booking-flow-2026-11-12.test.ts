import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { FULL_HOUSE_SLOTS, slotDisplay, slotsForCategory } from "../src/lib/booking-slots";
import { currentOtp, otpMatches, signVerified, verifyVerified, OTP_WINDOW_MS, VERIFIED_TTL_MS } from "../src/lib/booking-otp-token";
import { addOnSlotsFor } from "../src/lib/booking-addons";
import { detectAreaFromAddress } from "../src/lib/zonal-moq";
import { verifyCheckoutSignature } from "../src/server/razorpay";

const KEY = "unit-test-secret-key-0123456789";
const ALL = ["8:00 – 10:00 AM", "10:00 AM – 12:00 PM", "12:00 – 2:00 PM", "2:00 – 4:00 PM", "4:00 – 6:00 PM", "Flexible"].map((slot) => ({ slot }));

test("full house shows only the three morning windows; individual services show all but Flexible", () => {
  assert.deepEqual(slotsForCategory("HOME_DEEP_CLEANING", ALL).map((s) => s.slot), [...FULL_HOUSE_SLOTS]);
  assert.equal(slotsForCategory("INDIVIDUAL_CLEANING", ALL).length, 5);
  assert.ok(!slotsForCategory("PEST_CONTROL", ALL).some((s) => s.slot === "Flexible"));
});

test("slotDisplay writes AM/PM on both ends", () => {
  assert.equal(slotDisplay("8:00 – 10:00 AM"), "8:00 AM – 10:00 AM");
  assert.equal(slotDisplay("12:00 – 2:00 PM"), "12:00 PM – 2:00 PM");
  assert.equal(slotDisplay("10:00 AM – 12:00 PM"), "10:00 AM – 12:00 PM");
  assert.equal(slotDisplay("Flexible"), "Flexible");
});

test("OTP: matches current and previous window, rejects others; verified token binds mobile and expires", () => {
  const now = 1_800_000_000_000;
  const code = currentOtp("9876543210", now, KEY)!;
  assert.match(code, /^\d{6}$/);
  assert.ok(otpMatches("9876543210", code, now, KEY));
  assert.ok(otpMatches("9876543210", code, now + OTP_WINDOW_MS, KEY));
  assert.ok(!otpMatches("9876543210", code, now + 3 * OTP_WINDOW_MS, KEY));
  assert.ok(!otpMatches("9123456780", code, now, KEY));
  const tok = signVerified("9876543210", now, KEY)!;
  assert.ok(verifyVerified(tok, "9876543210", now + 1000, KEY));
  assert.ok(!verifyVerified(tok, "9123456780", now + 1000, KEY));
  assert.ok(!verifyVerified(tok, "9876543210", now + VERIFIED_TTL_MS + 1000, KEY));
  assert.ok(!verifyVerified("", "9876543210", now, KEY));
});

test("add-ons: full home has fridge/chimney/pest shot and no balcony; pest control has none", () => {
  const ids = addOnSlotsFor({ category: "HOME_DEEP_CLEANING", service: "Full House Deep Cleaning" }).map((s) => s.contentId);
  assert.deepEqual(ids, ["SCS-32", "SCS-35", "SCS-36"]);
  assert.ok(!ids.includes("SCS-34"));
  assert.equal(addOnSlotsFor({ category: "PEST_CONTROL", service: "Pest Control" }).length, 0);
});

test("detectAreaFromAddress finds the PIN and the earliest known locality", () => {
  const locs = [{ slug: "baner", name: "Baner" }, { slug: "wakad", name: "Wakad" }];
  const r = detectAreaFromAddress("Flat 402, Sky Tower, Baner Road, near Wakad bridge, Pune 411045", locs);
  assert.equal(r.pincode, "411045");
  assert.equal(r.locality, "baner");
  assert.deepEqual(detectAreaFromAddress("somewhere", locs), { pincode: "", locality: "", localityName: "" });
});

test("Razorpay checkout signature verifies and rejects tampering", () => {
  const sig = createHmac("sha256", "rzp_secret").update("order_1|pay_1").digest("hex");
  assert.ok(verifyCheckoutSignature("order_1", "pay_1", sig, "rzp_secret"));
  assert.ok(!verifyCheckoutSignature("order_1", "pay_2", sig, "rzp_secret"));
  assert.ok(!verifyCheckoutSignature("order_1", "pay_1", "bad", "rzp_secret"));
});
