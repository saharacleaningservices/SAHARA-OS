// Smart review funnel (owner 2026-10-25). Run: npm run test:review
import test from "node:test";
import assert from "node:assert/strict";
import { pickReviewChips, reviewPoolSize, reviewServiceOf, type ReviewService } from "../src/lib/review-chips";
import { templateByName } from "../src/lib/whatsapp-cloud-templates";

const SERVICES: ReviewService[] = ["HOME_DEEP_CLEANING", "COMMERCIAL_CLEANING", "HOUSEKEEPING", "PEST_CONTROL", "INTERIOR_PAINTING", "GENERAL"];

test("every service shows 4–5 distinct chips, stable for a seed, different between sessions", () => {
  for (const s of SERVICES) {
    const a = pickReviewChips(s, 12345);
    assert.ok(a.length >= 4 && a.length <= 5, `${s}: ${a.length}`);
    assert.equal(new Set(a).size, a.length);
    assert.deepEqual(a, pickReviewChips(s, 12345), "same seed → same set");
  }
  const sets = new Set(Array.from({ length: 30 }, (_, i) => pickReviewChips("HOME_DEEP_CLEANING", 1000 + i).join("|")));
  assert.ok(sets.size > 5, "rotates across sessions");
  assert.ok(reviewPoolSize("HOME_DEEP_CLEANING") > 5);
});

test("unknown service falls back to the general pool; chips carry local keywords", () => {
  assert.equal(reviewServiceOf("NOPE"), "GENERAL");
  assert.equal(reviewServiceOf(null), "GENERAL");
  assert.equal(reviewServiceOf("PEST_CONTROL"), "PEST_CONTROL");
  for (const s of SERVICES) {
    const chips = pickReviewChips(s, 7);
    assert.ok(chips.every((c) => c.length > 40 && c.length < 200), s);
    assert.ok(chips.filter((c) => /Pune|Hadapsar|Magarpatta|Sahara/.test(c)).length >= 3, `${s}: most chips carry a local keyword`);
  }
});

test("completion template v3 sends Rate Us on Google to /review with the booking token", () => {
  const t = templateByName("sahara_job_completed_v3")!;
  const b = t.buttons!.find((x) => x.text === "Rate Us on Google") as { url: string };
  assert.match(b.url, /\/review\?t=\{\{1\}\}$/);
});
