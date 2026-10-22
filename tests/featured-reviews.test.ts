// Settings → Social Proof: the structured Featured Reviews editor must round-trip the stored JSON without losing data.
// Run: npm run test:reviews
import test from "node:test";
import assert from "node:assert/strict";
import { parseFeaturedReviews, serializeFeaturedReviews, MAX_FEATURED_REVIEWS } from "../src/lib/featured-reviews";

test("blank means no reviews; empty list saves as blank", () => {
  assert.deepEqual(parseFeaturedReviews(""), { ok: true, reviews: [] });
  assert.deepEqual(parseFeaturedReviews(null), { ok: true, reviews: [] });
  assert.equal(serializeFeaturedReviews([]), "");
});

test("existing JSON round-trips to the same shape the booking page reads", () => {
  const stored = JSON.stringify([{ name: "Priya S.", text: "On time.", rating: 5 }, { name: "Rahul", text: "Good job", rating: 4 }]);
  const p = parseFeaturedReviews(stored);
  assert.equal(p.ok, true);
  if (!p.ok) return;
  assert.equal(serializeFeaturedReviews(p.reviews), stored);
});

test("unknown keys on an entry are preserved; missing rating defaults to 5; out-of-range ratings are clamped", () => {
  const p = parseFeaturedReviews(JSON.stringify([{ name: "A", text: "x", source: "google", date: "2026-10-01" }, { name: "B", text: "y", rating: 9 }]));
  assert.equal(p.ok, true);
  if (!p.ok) return;
  assert.equal(p.reviews[0].rating, 5);
  assert.equal(p.reviews[1].rating, 5);
  const back = JSON.parse(serializeFeaturedReviews(p.reviews));
  assert.deepEqual(back[0], { source: "google", date: "2026-10-01", name: "A", text: "x", rating: 5 });
});

test("text that is not a JSON list is reported, never silently replaced", () => {
  for (const bad of ["not json", '{"name":"x"}', "[1,2]", '[{"name":"a"}, "b"]']) {
    const p = parseFeaturedReviews(bad);
    assert.equal(p.ok, false, bad);
    if (!p.ok) assert.equal(p.raw, bad);
  }
});

test("blank rows are dropped, text is trimmed, and the list is capped", () => {
  const rows = Array.from({ length: MAX_FEATURED_REVIEWS + 3 }, (_, i) => ({ name: ` N${i} `, text: "t", rating: 4 }));
  rows.splice(1, 0, { name: "  ", text: " ", rating: 5 });
  const out = JSON.parse(serializeFeaturedReviews(rows));
  assert.equal(out.length, MAX_FEATURED_REVIEWS);
  assert.equal(out[0].name, "N0");
  assert.ok(out.every((r: { name: string }) => r.name.trim().length > 0));
});
