import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { FULL_HOUSE_SLOTS, slotDisplay, slotsForCategory } from "../src/lib/booking-slots";
import { currentOtp, otpMatches, signVerified, verifyVerified, OTP_WINDOW_MS, VERIFIED_TTL_MS } from "../src/lib/booking-otp-token";
import { addOnSlotsFor } from "../src/lib/booking-addons";
import { PRICING_MASTER } from "../src/lib/pricing-master";
import { PLATINUM_EXCLUDED, PLATINUM_SCOPE, PREMIUM_EXCLUDED, PREMIUM_SCOPE } from "../src/lib/marketing-content";
import { homeScopeByArea } from "../src/lib/service-scope";
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

test("add-ons: home & kitchen lists, per-seat sofa, pest control none", () => {
  const home = addOnSlotsFor({ category: "HOME_DEEP_CLEANING", service: "Full House Deep Cleaning" });
  assert.deepEqual(home.map((s) => s.contentId), ["SCS-39", "SCS-32", "SCS-37", "SCS-38", "SCS-09", "SCS-36"], "chimney is included in the furnished full home (owner 2026-11-14), so not offered as an add-on");
  assert.ok(!home.some((s) => s.contentId === "SCS-34"), "no balcony in full home");
  assert.equal(home.find((s) => s.contentId === "SCS-09")?.perUnit, true);
  assert.deepEqual(addOnSlotsFor({ category: "INDIVIDUAL_CLEANING", service: "Kitchen Deep Cleaning" }).map((s) => s.contentId), ["SCS-39", "SCS-32", "SCS-37", "SCS-38", "SCS-35"]);
  assert.equal(addOnSlotsFor({ category: "PEST_CONTROL", service: "Pest Control" }).length, 0);
});

test("pricing master: owner add-on prices, per-seat sofa, chimney included in the furnished full-home scope", () => {
  const p = (id: string) => PRICING_MASTER.find((i) => i.contentId === id)!;
  assert.deepEqual(["SCS-39", "SCS-32", "SCS-37", "SCS-38", "SCS-35"].map((id) => p(id).price), [599, 499, 699, 299, 599]); // chimney ₹599 = Pune market rate (2026-11-14)
  assert.equal(p("SCS-09").price, 199);
  assert.equal(p("SCS-09").unit, "per seat");
  assert.equal(p("SCS-09").minQty, 1);
  assert.ok(PREMIUM_SCOPE.join(" ").toLowerCase().includes("chimney") && PLATINUM_SCOPE.join(" ").toLowerCase().includes("chimney"));
  assert.ok(!PREMIUM_EXCLUDED.some((x) => /chimney/i.test(x)) && !PLATINUM_EXCLUDED.some((x) => /chimney/i.test(x)));
  assert.ok(homeScopeByArea("Premium").flatMap((a) => a.items).some((i) => /chimney/i.test(i.item)));
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
