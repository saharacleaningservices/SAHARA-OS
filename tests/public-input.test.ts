// Public booking input guards + lead attribution (2026-10-12).
// Run: npm run test:public   (pure functions only — no database)
import test from "node:test";
import assert from "node:assert/strict";
import { clampDays, isValidYmd, sanitizeChangeRequest } from "../src/lib/public-input";
import { rateLimit } from "../src/lib/rate-limit";
import { classifyTouch, leadSourceBucket } from "../src/lib/attribution";

test("isValidYmd accepts real dates only", () => {
  assert.equal(isValidYmd("2026-10-12"), true);
  assert.equal(isValidYmd("2026-02-30"), false);
  assert.equal(isValidYmd("2026-10-12T10:00:00Z"), false);
  assert.equal(isValidYmd("12-10-2026"), false);
  assert.equal(isValidYmd(undefined), false);
  assert.equal(isValidYmd({}), false);
});

test("clampDays caps and defaults", () => {
  assert.equal(clampDays(21), 21);
  assert.equal(clampDays(10_000), 45);
  assert.equal(clampDays(0), 1);
  assert.equal(clampDays(-5), 1);
  assert.equal(clampDays(Number.NaN), 21);
  assert.equal(clampDays("9" as unknown), 21);
  assert.equal(clampDays(7.9), 7);
});

test("sanitizeChangeRequest bounds note and validates date", () => {
  const long = "x".repeat(5000);
  assert.equal(sanitizeChangeRequest(long, "2026-10-20").note.length, 300);
  assert.equal(sanitizeChangeRequest(undefined, "2026-10-20").note, "");
  assert.equal(sanitizeChangeRequest(123, undefined).note, "");
  assert.equal(sanitizeChangeRequest("ok", "tomorrow").preferredDate, undefined);
  assert.equal(sanitizeChangeRequest("ok", "2026-10-20").preferredDate, "2026-10-20");
  assert.equal(sanitizeChangeRequest("  hi  ", undefined).note, "hi");
});

test("rateLimit blocks after the limit and keys are independent", () => {
  const k = `test:${Date.now()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(k, 3, 60).allowed, true);
  assert.equal(rateLimit(k, 3, 60).allowed, false);
  assert.equal(rateLimit(`${k}:other`, 3, 60).allowed, true);
});

test("attribution: new channels, existing channels and unknown handling", () => {
  assert.equal(classifyTouch({ source: "youtube", medium: "shorts" }), "YouTube");
  assert.equal(classifyTouch({ source: "linkedin" }), "LinkedIn");
  assert.equal(classifyTouch({ source: "email", medium: "outreach" }), "Email Outreach");
  assert.equal(classifyTouch({ referrer: "https://www.youtube.com/watch" }), "YouTube");
  assert.equal(classifyTouch({ referrer: "https://lnkd.in/x" }), "LinkedIn");
  assert.equal(classifyTouch({ gclid: "g", source: "youtube" }), "Google Ads");
  assert.equal(classifyTouch({ source: "gmb" }), "Google Business Profile");
  assert.equal(classifyTouch({ source: "facebook" }), "Facebook Organic");
  assert.equal(classifyTouch({ source: "meta_ads" }), "Meta Ads");
  assert.equal(classifyTouch({ source: "whatsapp", campaign: "diwali" }), "WhatsApp Marketing");
  assert.equal(classifyTouch({ source: "somethingnew" }), "Other");
  assert.equal(classifyTouch({}), "Unattributed");
  assert.equal(classifyTouch(null), "Unattributed");
  assert.equal(leadSourceBucket("YouTube"), "Organic");
  assert.equal(leadSourceBucket("not-a-channel"), "Unknown / not tracked");
});
