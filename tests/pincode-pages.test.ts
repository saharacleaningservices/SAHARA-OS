import test from "node:test";
import assert from "node:assert/strict";
import { PINCODE_PAGES, PINCODE_REDIRECTS, PINCODE_BATCH1, areaPath } from "../src/lib/pincode-pages";
import { BRANCHES } from "../src/config/pune-seo-matrix";

// Pune pincode landing pages (local SEO rollout, owner 2026-11-04).

test("22 pincode pages, unique slugs, no prices", () => {
  assert.equal(PINCODE_PAGES.length, 22);
  assert.equal(new Set(PINCODE_PAGES.map((p) => p.slug)).size, 22);
  for (const p of PINCODE_PAGES) {
    assert.match(p.slug, /^cleaning-services-[a-z-]+-\d{6}$/, p.slug);
    assert.doesNotMatch(p.body, /₹|Rs\.?\s?\d/, `${p.slug}: no hard-coded price`);
  }
});

test("page address block matches the Mohammadwadi branch schema (owner 2026-11-04: Maps address)", () => {
  const street = BRANCHES.mohammadwadi.streetAddress!;
  for (const p of PINCODE_PAGES) {
    assert.ok(p.body.includes(`${street}, Pune, Maharashtra ${BRANCHES.mohammadwadi.postalCode}`), p.slug);
    assert.doesNotMatch(p.body, /Royal Complex/, p.slug);
  }
});

test("Batch 1 redirects point at existing pincode pages, one per area", () => {
  const slugs = new Set(PINCODE_PAGES.map((p) => `/${p.slug}`));
  assert.equal(PINCODE_REDIRECTS.length, 7);
  for (const r of PINCODE_REDIRECTS) {
    assert.match(r.source, /^\/pune\/[a-z-]+$/);
    assert.ok(slugs.has(r.destination), r.destination);
    assert.equal(r.permanent, true);
  }
  assert.equal(areaPath("undri"), PINCODE_BATCH1.undri);
  assert.equal(areaPath("baner"), "/pune/baner", "Batch 2 areas keep their /pune page for now");
});
