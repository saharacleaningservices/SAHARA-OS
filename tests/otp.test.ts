import test from "node:test";
import assert from "node:assert/strict";

import { generateOtpCode, hashOtp, otpMatches } from "../src/lib/otp";
import { validCoords } from "../src/lib/geo";

// The secret is read lazily at call time, so setting it after import is fine.
process.env.AUTH_SECRET = "test-secret";

test("codes are 6 digits", () => {
  for (let i = 0; i < 200; i++) assert.match(generateOtpCode(), /^\d{6}$/);
});

test("hash verifies only for the right code and scope", () => {
  const h = hashOtp("123456", "login:abc");
  assert.equal(otpMatches("123456", "login:abc", h), true);
  assert.equal(otpMatches(" 123456 ", "login:abc", h), true);
  assert.equal(otpMatches("123457", "login:abc", h), false);
  assert.equal(otpMatches("123456", "login:other", h), false);
  assert.equal(otpMatches("123456", "login:abc", "pending"), false);
});

test("coordinate validation", () => {
  assert.deepEqual(validCoords(18.52, 73.85), { lat: 18.52, lng: 73.85 });
  assert.equal(validCoords(91, 0), null);
  assert.equal(validCoords(0, 181), null);
  assert.equal(validCoords(NaN, 1), null);
  assert.equal(validCoords("18" as never, 73), null);
});
