// AI-search / local SEO facts: business JSON-LD and /llms.txt. Run: npm run test:geo
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildBusinessJsonLd, SCHEMA_SERVICES, BUSINESS_GEO } from "../src/lib/seo-schema";
import { CONTACT } from "../src/lib/marketing-content";

test("business JSON-LD: NAP from the single CONTACT source, geo, map, services, slogan", () => {
  const j = buildBusinessJsonLd({ sameAs: ["https://example.test/profile"] });
  assert.equal(j["@type"], "HomeAndConstructionBusiness");
  assert.equal(j.name, "Sahara Cleaning Services");
  assert.deepEqual(j.telephone, CONTACT.call.map((n) => `+91${n}`));
  assert.ok(j.telephone.includes("+917083347130"));
  assert.equal(j.address.addressLocality, "Pune");
  assert.equal(j.foundingDate, "2012");
  assert.equal(j.slogan, "Serving Pune Since 2012");
  assert.deepEqual({ latitude: j.geo.latitude, longitude: j.geo.longitude }, BUSINESS_GEO);
  assert.match(j.hasMap, /google\.com\/maps/);
  assert.equal(j.hasOfferCatalog.itemListElement.length, SCHEMA_SERVICES.length);
  for (const o of j.hasOfferCatalog.itemListElement) assert.match(o.itemOffered.url, /^https:\/\/booking\.saharacleaningservices\.com\//);
  assert.deepEqual(j.sameAs, ["https://example.test/profile"]);
});

test("business JSON-LD carries no prices; rating is the public GBP figure (owner 2026-10-26)", () => {
  const j = buildBusinessJsonLd() as Record<string, unknown> & { aggregateRating: { ratingValue: string; ratingCount: number } };
  const s = JSON.stringify(j);
  for (const key of ["price", "priceRange", "review"]) assert.ok(!s.includes(`"${key}"`), `unexpected ${key}`);
  assert.ok(!/₹|\bbest\b|\btop\b|#1/i.test(s), "no prices or superlative claims");
  assert.equal(j.aggregateRating.ratingValue, "4.9");
  assert.equal(j.aggregateRating.ratingCount, 1800);
});

test("business JSON-LD: GSTIN, three contact points (primary, GMB, WhatsApp API), owner micro-locations, booking action", () => {
  const j = buildBusinessJsonLd() as Record<string, unknown> & { contactPoint: { telephone: string }[]; areaServed: { name: string }[]; potentialAction: { target: { urlTemplate: string } } };
  assert.equal(j.taxID, "27DMTPS3584R2ZJ");
  assert.deepEqual(j.contactPoint.map((c) => c.telephone), ["+918956567130", "+917083347130", "+919175220270"]);
  const names = j.areaServed.map((a) => a.name);
  for (const a of ["Magarpatta City", "Kharadi", "Wakad", "Baner", "Hadapsar", "Viman Nagar", "Hinjewadi", "Kothrud", "Aundh", "Undri", "Kondhwa", "Koregaon Park", "Shivajinagar"]) assert.ok(names.includes(`${a}, Pune`), a);
  assert.equal(new Set(names).size, names.length, "no duplicate areas");
  assert.equal(j.potentialAction.target.urlTemplate, "https://saharacleaningservices.com/booking");
});

test("page-specific extras still merge in (package offers on the home-cleaning pages)", () => {
  const j = buildBusinessJsonLd({ extra: { makesOffer: [{ "@type": "Offer", name: "x" }] } }) as Record<string, unknown>;
  assert.ok(Array.isArray(j.makesOffer));
});

test("/llms.txt: plain facts, booking links, no prices, no superlatives", () => {
  const t = readFileSync(path.join(process.cwd(), "public/llms.txt"), "utf8");
  assert.match(t, /^# Sahara Cleaning Services/m);
  assert.match(t, /Serving Pune since 2012/);
  assert.match(t, /https:\/\/booking\.saharacleaningservices\.com\/booking/);
  for (const n of CONTACT.call) assert.ok(t.replace(/\s/g, "").includes(n), `phone ${n} listed`);
  assert.ok(!/₹|Rs\.?\s?\d/.test(t), "no prices");
  assert.ok(!/\b(best|top|number one|#1|cheapest)\b/i.test(t), "no superlative claims");
});
