import test from "node:test";
import assert from "node:assert/strict";

import { generateOtpCode, hashOtp, otpMatches, JOB_OTP_LENGTH } from "../src/lib/otp";
import { googleMapsNavUrl, coordsFromMapLink, distanceMeters } from "../src/lib/maps";
import { validCoords } from "../src/lib/geo";

// The secret is read lazily at call time, so setting it after import is fine.
process.env.AUTH_SECRET = "test-secret";

test("codes are 6 digits", () => {
  for (let i = 0; i < 200; i++) assert.match(generateOtpCode(), /^\d{6}$/);
});

test("customer start/completion codes are 4 digits", () => {
  assert.equal(JOB_OTP_LENGTH, 4);
  for (let i = 0; i < 200; i++) assert.match(generateOtpCode(JOB_OTP_LENGTH), /^\d{4}$/);
});

test("Google Maps navigation URL: coordinates, shared pin, then address", () => {
  assert.match(googleMapsNavUrl({ address: "x", mapLink: "https://www.google.com/maps/@18.5204,73.8567,17z" })!, /destination=18\.5204%2C73\.8567/);
  assert.match(googleMapsNavUrl({ address: "x", mapLink: "https://maps.google.com/?q=18.5,73.85" })!, /destination=18\.5%2C73\.85/);
  assert.equal(googleMapsNavUrl({ address: "x", mapLink: "https://maps.app.goo.gl/abc" }), "https://maps.app.goo.gl/abc");
  assert.match(googleMapsNavUrl({ address: "Flat 4, Kothrud, Pune", mapLink: null })!, /destination=Flat%204%2C%20Kothrud%2C%20Pune/);
  assert.equal(googleMapsNavUrl({ address: "", mapLink: null }), null);
  assert.deepEqual(coordsFromMapLink("https://x/!3d18.51!4d73.86"), { lat: 18.51, lng: 73.86 });
  assert.ok(distanceMeters({ lat: 18.52, lng: 73.85 }, { lat: 18.52, lng: 73.86 }) > 1000);
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
