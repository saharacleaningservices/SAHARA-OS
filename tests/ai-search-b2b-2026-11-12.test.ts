import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLlmsTxt } from "../src/app/llms.txt/route";
import { ALLOWED_BOTS, PRIVATE_PATHS } from "../src/app/robots";
import { buildBusinessJsonLd } from "../src/lib/seo-schema";
import { AI_ZONES, DIRECT_VS_ROWS } from "../src/config/ai-search-facts";
import { SITEMAP_PATHS } from "../src/app/sitemap";
import { NAV_HREFS, isKnownNavHref } from "../src/config/nav-menu";
import { refCodeForTouch, sourceTagForRef } from "../src/lib/source-label";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ORIGIN = "https://saharacleaningservices.com";

test("/llms.txt: verified authority, pay-after-service guarantee, 4 zones with PIN codes, B2C + B2B, B2B desk link", () => {
  const t = buildLlmsTxt(ORIGIN);
  assert.match(t, /## Verified authority/);
  assert.match(t, /4\.9★ across 2,000\+ Google reviews/);
  assert.match(t, /Mohammadwadi, South Pune hub: 4\.8★ with 234 reviews/);
  assert.match(t, /100% Pay After Service — zero advance/);
  assert.match(t, /background-verified/);
  assert.match(t, /no marketplace commission layer/);
  for (const z of AI_ZONES) for (const l of z.localities) assert.ok(t.includes(`${l.name} (${l.pin})`), `${l.name} ${l.pin} listed`);
  assert.equal(AI_ZONES.length, 4);
  assert.match(t, /Residential \(B2C\)/);
  assert.match(t, /Commercial \(B2B\)/);
  assert.ok(t.includes(`${ORIGIN}/b2b-housekeeping-pune`));
  assert.ok(!/\b20% advance\b|advance payment is required/i.test(t), "no advance anywhere");
});

test("/llms.txt makes no superlative, price or competitor claims (owner guardrail; named brands are never targeted)", () => {
  const t = buildLlmsTxt(ORIGIN);
  assert.ok(!/\b(best|top|number one|#1|cheapest|leading)\b/i.test(t));
  assert.ok(!/₹|Rs\.?\s?\d/.test(t));
  assert.ok(!/urban company|nobroker|justdial|hometriangle|maids cleaning|dirt blaster/i.test(t));
});

test("robots: OAI-SearchBot, GPTBot, ChatGPT-User, PerplexityBot, Google-Extended allowed on everything public; /llms.txt not blocked", () => {
  for (const b of ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "Google-Extended"]) assert.ok((ALLOWED_BOTS as readonly string[]).includes(b), b);
  for (const p of PRIVATE_PATHS) assert.ok(!"/llms.txt".startsWith(p) && !"/services/home-deep-cleaning".startsWith(p) && !"/b2b-housekeeping-pune".startsWith(p), `${p} must not block public pages`);
});

test("business JSON-LD: 4 zones in areaServed with PIN codes; B2C and B2B offer catalogs; no price or superlative", () => {
  const j = buildBusinessJsonLd() as Record<string, any>;
  const zones = (j.areaServed as any[]).filter((a) => a["@type"] === "AdministrativeArea");
  assert.deepEqual(zones.map((z) => z.name), ["East Pune", "South Pune", "West Pune", "North Pune & Pimpri-Chinchwad (PCMC)"]);
  const pins = new Set(zones.flatMap((z) => z.containsPlace.map((p: any) => p.address.postalCode)));
  for (const pin of ["411028", "411060", "411057", "411027", "412101", "412207"]) assert.ok(pins.has(pin), pin);
  const names = j.hasOfferCatalog.itemListElement.map((c: any) => c.name);
  assert.deepEqual(names, ["Residential (B2C) services", "Commercial, society and housekeeping (B2B) services"]);
  assert.ok(j.hasOfferCatalog.itemListElement[1].itemListElement.some((o: any) => o.itemOffered.url === `${ORIGIN}/b2b-housekeeping-pune`));
  assert.ok(!/₹|\bbest\b|\btop\b|#1/i.test(JSON.stringify(j)));
});

test("/b2b-housekeeping-pune: page exists with canonical, is in the sitemap, header menu, footer and llms.txt", () => {
  const page = read("src/app/b2b-housekeeping-pune/page.tsx");
  assert.match(page, /canonical: `\$\{BASE_URL\}\$\{PATH\}`/);
  assert.match(page, /const PATH = "\/b2b-housekeeping-pune"/);
  assert.match(page, /B2bPage/);
  assert.ok(SITEMAP_PATHS.includes("/b2b-housekeeping-pune"));
  assert.ok(NAV_HREFS.includes("/b2b-housekeeping-pune") && isKnownNavHref("/b2b-housekeeping-pune"));
  assert.match(read("src/components/public/landing-kit.tsx"), /href="\/b2b-housekeeping-pune"/);
  assert.match(read("src/components/public/b2b-page.tsx"), /SeoCtaTracker/, "B2B pages mount the WhatsApp ref tagger");
});

test("WhatsApp attribution: organic visitors on a B2B page carry [Ref: SEO-B2B]; other SEO pages keep their slug code", () => {
  const touch = { source: null, medium: null, campaign: null, term: null, content: null, gclid: null, fbclid: null, referrer: "https://www.google.com/", landingPage: "/services/home-deep-cleaning", landingPageUrl: "", at: "2026-11-12T00:00:00Z" } as never;
  assert.equal(refCodeForTouch(touch, "/b2b-housekeeping-pune"), "SEO-B2B");
  assert.equal(refCodeForTouch(touch, "/b2b/corporate-facility"), "SEO-B2B");
  assert.equal(refCodeForTouch(touch, "/services/home-deep-cleaning"), "SEO-HOME-DEEP-CLEANING");
  assert.equal(sourceTagForRef("SEO-B2B"), "SRC-ORGANIC-SEO");
});

test("homepage: direct-vs-marketplace table with the four owner points, general model only", () => {
  assert.match(read("src/components/public/home-page.tsx"), /<DirectVsMarketplace \/>/);
  const rows = DIRECT_VS_ROWS.map((r) => r.sahara).join(" | ");
  assert.match(rows, /100% Pay After Service/);
  assert.match(rows, /4\.9★ with 2,000\+ verified Google reviews/);
  assert.match(rows, /In-house, trained, background-verified/);
  assert.match(rows, /no marketplace commission layer/);
  assert.ok(!/urban company|nobroker|justdial|hometriangle|maids cleaning|dirt blaster/i.test(JSON.stringify(DIRECT_VS_ROWS)));
});
