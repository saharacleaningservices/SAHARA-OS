import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_BOOKING_URL } from "../src/lib/site-urls";
import { ALLOWED_BOTS } from "../src/app/robots";
import { SITEMAP_PATHS } from "../src/app/sitemap";
import { SERVICE_RENAME_REDIRECTS } from "../src/lib/legacy-redirects";
import { CATALOG_SERVICES, catalogServiceBySlug } from "../src/config/service-catalog";
import { LOCALITIES, PROGRAMMATIC_PAGES, SERVICE_CATEGORIES } from "../src/config/pune-seo-matrix";
import { B2B_COVERAGE, B2C_COVERAGE, coverageJsonLd } from "../src/config/geo-coverage";
import { buildLlmsTxt } from "../src/app/llms.txt/route";
import { seoDescription, localIntro, pageFaqs } from "../src/lib/seo-copy";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("BOOKING_URL fallback is the apex domain, never app.*", () => {
  assert.equal(process.env.BOOKING_URL, undefined);
  assert.equal(PUBLIC_BOOKING_URL, "https://saharacleaningservices.com");
  assert.doesNotMatch(read("src/lib/site-urls.ts").split("\n").filter((l) => l.includes("PUBLIC_BOOKING_URL =")).join(""), /LEGACY_APP_URL/);
});

test("robots.txt names every search + AI crawler and treats apex and www as public", () => {
  assert.deepEqual([...ALLOWED_BOTS], ["Googlebot", "Bingbot", "OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"]);
  const src = read("src/app/robots.ts");
  assert.match(src, /replace\(\/\^www\\\.\//);
  assert.match(src, /sitemap: `\$\{PUBLIC_BOOKING_URL\}\/sitemap\.xml`/);
});

test("sitemap lists every B2C + B2B service page and all locality pages", () => {
  for (const p of ["/services/home-deep-cleaning", "/services/individual-services", "/services/commercial-services", "/services/facility-management", "/services/interior-painting", "/services/pest-control", "/services/bathroom-deep-cleaning", "/services/sofa-upholstery-cleaning", "/services/residential-services"]) {
    assert.ok(SITEMAP_PATHS.includes(p), `${p} missing from sitemap`);
  }
  for (const s of CATALOG_SERVICES) assert.ok(SITEMAP_PATHS.includes(`/services/${s.slug}`), s.slug);
  assert.ok(LOCALITIES.length >= 47);
  assert.equal(PROGRAMMATIC_PAGES.length, LOCALITIES.length * SERVICE_CATEGORIES.length);
  for (const p of PROGRAMMATIC_PAGES) assert.ok(SITEMAP_PATHS.includes(`/services/${p.category}/${p.location}`));
  assert.ok(!SITEMAP_PATHS.some((p) => /bathroom-scrubbing|sofa-upholstery-shampooing/.test(p)));
});

test("renames: Bathroom Deep Cleaning + Sofa & Upholstery Cleaning, old URLs 301", () => {
  assert.equal(catalogServiceBySlug("bathroom-deep-cleaning")?.name, "Bathroom Deep Cleaning");
  const sofa = catalogServiceBySlug("sofa-upholstery-cleaning");
  assert.equal(sofa?.name, "Sofa & Upholstery Cleaning");
  assert.match(sofa!.blurb, /Extraction shampooing of fabric sofas and chairs/);
  assert.equal(catalogServiceBySlug("sofa-upholstery-shampooing"), undefined);
  const to = (s: string) => SERVICE_RENAME_REDIRECTS.find((r) => r.source === s);
  assert.equal(to("/services/individual-services/bathroom-scrubbing")?.destination, "/services/bathroom-deep-cleaning");
  assert.equal(to("/services/individual-services/bathroom-scrubbing")?.statusCode, 301);
  assert.equal(to("/services/sofa-upholstery-shampooing")?.destination, "/services/sofa-upholstery-cleaning");
  assert.equal(to("/services/commercial-cleaning")?.destination, "/services/commercial-services");
  for (const f of ["src/config/service-catalog.ts", "src/config/service-packages.ts"]) assert.doesNotMatch(read(f), /Bathroom Scrubbing|Sofa & Upholstery Shampooing/);
});

test("hero: 2.2 s slider, gradient hero with trust strip, no duplicate bottom Before/After on individual/residential", () => {
  assert.match(read("src/components/public/service-slider.tsx"), /const ROTATE_MS = 2200/);
  const hero = read("src/components/public/service-split-hero.tsx");
  assert.match(hero, /bg-gradient-to-br from-slate-50 via-blue-50\/40 to-white/);
  assert.match(hero, /border-4 border-white[^"]*shadow-xl/);
  for (const t of ["4.9★ Rated in Pune", "60-Min Dispatch", "Eco-Safe Chemicals"]) assert.ok(hero.includes(t), t);
  assert.match(read("src/app/(public)/services/[category]/page.tsx"), /s\.category !== "individual" && s\.category !== "residential" && \(\s*<WorkGallery/);
});

test("header shows inline desktop links; single floating Direct Call button", () => {
  const h = read("src/components/public/mega-menu.tsx");
  for (const l of ["Home", "Services", "Commercial / B2B", "Reviews", "Contact"]) assert.ok(h.includes(`"${l}"`), l);
  assert.match(h, /hidden items-center gap-1 lg:flex/);
  const fab = read("src/components/public/floating-contact.tsx");
  assert.match(fab, /PhoneCall/);
  assert.match(fab, /fixed bottom-20 right-5 z-50 sm:bottom-5/);
  assert.doesNotMatch(fab, /wa\.me|MessageCircle/);
});

test("inner pages: no GST invoice / branch dispatch / since 2012 copy; four homeowner trust points", () => {
  const files = ["src/app/(public)/services/[category]/[location]/page.tsx", "src/app/(public)/services/[category]/page.tsx", "src/app/(public)/services/page.tsx", "src/app/pune/page.tsx", "src/app/pune/[area]/page.tsx", "src/lib/seo-copy.ts"];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /GST invoice|since 2012|Since 2012|Served from our|dispatched through|dispatched from our|Dispatch from the/i, f);
  }
  const l = LOCALITIES[0], c = SERVICE_CATEGORIES[0];
  assert.doesNotMatch(`${seoDescription(c, l)} ${localIntro(c, l)} ${JSON.stringify(pageFaqs(c, l))}`, /GST|2012|branch/i);
  assert.match(read("src/config/hero-trust.ts"), /Trained in-house staff[\s\S]*No outsourced work[\s\S]*Eco-safe, child & pet-friendly chemicals[\s\S]*100% satisfaction — free re-clean guarantee/);
});

test("contact branch cards drop the zone sub-lines", () => {
  const s = read("src/components/public/branch-cards.tsx");
  assert.doesNotMatch(s, /Serves|zonesOf|ZONES/);
  for (const k of ["Get directions", "WhatsApp", "postalCode"]) assert.ok(s.includes(k), k);
});

test("homepage: 6-card grid, About copy, recommended combo first, expansion line", () => {
  const cb = read("src/components/public/catalog-blocks.tsx");
  assert.match(cb, /Commercial Cleaning", sub: "Offices, Shops, Showrooms & Warehouses"/);
  assert.match(cb, /Facility Management Services", sub: "Society, Office, Hospital, Restaurant & Hotel Housekeeping"/);
  assert.match(cb, /grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3/);
  assert.match(cb, /RECOMMENDED_COMBO = "Kitchen \+ 2 Bathroom \+ Fridge"/);
  assert.match(cb, /★ Recommended/);
  const hp = read("src/components/public/home-page.tsx");
  assert.match(hp, /<h2 id="about-title"[^>]*>Sahara Cleaning Services<\/h2>/);
  assert.match(hp, /flats, bungalows, row houses, penthouses/);
  assert.match(read("src/components/public/home-sections.tsx"), /Currently serving in Pune and PCMC\. Coming soon Mumbai and Bangalore\./);
});

test("GEO: every coverage item links to a real page; llms.txt + schema carry the catalog and five zones", () => {
  const real = new Set(SITEMAP_PATHS);
  for (const i of [...B2C_COVERAGE, ...B2B_COVERAGE]) assert.ok(real.has(i.href), `${i.name} -> ${i.href}`);
  const names = [...B2C_COVERAGE, ...B2B_COVERAGE].map((i) => i.name);
  for (const n of ["Bungalow Cleaning", "Row House Cleaning", "Penthouse Cleaning", "Hospital & Clinic Sanitisation", "IT Park Cleaning", "School, College & Institute Cleaning"]) assert.ok(names.includes(n), n);
  const ld = JSON.stringify(coverageJsonLd("https://saharacleaningservices.com"));
  for (const z of ["East Pune", "West Pune & PCMC", "North Pune", "South & Central Pune", "Central Pune", "Pimpri-Chinchwad"]) assert.ok(ld.includes(z), z);
  const t = buildLlmsTxt("https://saharacleaningservices.com");
  for (const k of ["Established: 2012", "8,000+", "Magarpatta City", "Mohammadwadi", "no outsourced work", "https://saharacleaningservices.com/sitemap.xml", "/services/bathroom-deep-cleaning", "hospital and clinic sanitisation"]) assert.ok(t.includes(k), k);
  assert.doesNotMatch(t, /app\.saharacleaningservices|booking\.saharacleaningservices/);
});
