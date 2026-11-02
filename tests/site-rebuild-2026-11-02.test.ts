import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, catalogServiceBySlug } from "../src/config/service-catalog";
import { PRICING_MASTER } from "../src/lib/pricing-master";
import { SERVICE_CATEGORIES } from "../src/config/pune-seo-matrix";
import { PUNE_AREAS } from "../src/lib/pune-areas";

test("catalog: 4 categories with the owner's service list, unique slugs", () => {
  assert.deepEqual(CATALOG_CATEGORIES.map((c) => c.id), ["residential", "individual", "commercial", "relocation"]);
  const slugs = CATALOG_SERVICES.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate catalog slug");
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
  for (const name of ["Full House Deep Cleaning", "Unfurnished Home Cleaning", "Move-in / Move-out Cleaning", "Post-Interior Cleaning", "Pest Control", "Interior Painting", "Kitchen Deep Cleaning", "Bathroom Scrubbing", "Sofa & Upholstery Shampooing", "Carpet Cleaning", "Balcony & Window Scrubbing", "Office Cleaning", "Showroom Cleaning", "Warehouse Cleaning", "Facade & Glass Cleaning", "Commercial Kitchen / Restaurant Cleaning", "Post-Construction Cleaning", "Commercial AMC & Facility Management", "Packers & Movers", "Rent Agreement & Police Verification", "Property Snagging / Home Inspection"]) {
    assert.ok(CATALOG_SERVICES.some((s) => s.name === name), `missing ${name}`);
  }
});

test("catalog pricing: fixed only where the pricing master has a rate; B2B, painting, post-construction and relocation on inspection", () => {
  for (const s of CATALOG_SERVICES) {
    if (s.category === "commercial" || s.category === "relocation" || /paint|post-|pest/.test(s.slug)) assert.equal(s.pricing.mode, "inspection", s.slug);
    for (const id of s.pricing.contentIds ?? []) assert.ok(PRICING_MASTER.some((p) => p.contentId === id), `${s.slug}: unknown price id ${id}`);
    if (s.seoCategory) assert.ok(SERVICE_CATEGORIES.some((c) => c.slug === s.seoCategory), `${s.slug}: unknown seo category`);
  }
  assert.equal(catalogServiceBySlug("home-deep-cleaning")?.pricing.mode, "bhk");
  // No price is ever hard-coded in the catalog.
  assert.doesNotMatch(readFileSync("src/config/service-catalog.ts", "utf8"), /₹\s?\d/);
});

test("lead modal: name, mobile, date, GPS + area fallback, notes; returns a Lead ID; alerts in the background", () => {
  const m = readFileSync("src/components/public/bhk-price-cards.tsx", "utf8");
  for (const f of ['name="name"', 'name="mobile"', 'name="date"', 'name="area"', 'name="notes"', "navigator.geolocation", "Use current location", "leadId"]) assert.ok(m.includes(f), f);
  const api = readFileSync("src/app/api/leads/submit/route.ts", "utf8");
  assert.match(api, /leadId/);
  assert.match(api, /void sendEmail\(/, "management e-mail never blocks the response");
});

test("header: dual branch numbers, pulsing Call / WhatsApp, GSTIN and rating badges", () => {
  const h = readFileSync("src/components/public/mega-menu.tsx", "utf8");
  for (const f of ["BRANCHES.magarpatta", "BRANCHES.mohammadwadi", "sahara-wave-call", "sahara-wave-wa", "COMPANY.gstin", "TRUST.rating"]) assert.ok(h.includes(f), f);
  assert.doesNotMatch(h, /<details key=/, "no nested accordions in the mobile menu");
});

test("area hubs: Magarpatta, Wakad, Kharadi, Baner, Hinjewadi, Mohammadwadi and PCMC", () => {
  for (const s of ["magarpatta", "wakad", "kharadi", "baner", "hinjewadi", "mohammadwadi", "pcmc"]) assert.ok(PUNE_AREAS.some((a) => a.slug === s), s);
});

test("sitemap lists every catalog page and the scope-of-work policy", async () => {
  const { SITEMAP_PATHS } = await import("../src/app/sitemap");
  for (const s of CATALOG_SERVICES) assert.ok(SITEMAP_PATHS.includes(`/services/${s.slug}`), s.slug);
  assert.ok(SITEMAP_PATHS.includes("/scope-of-work"));
  assert.equal(new Set(SITEMAP_PATHS).size, SITEMAP_PATHS.length, "duplicate sitemap path");
});
