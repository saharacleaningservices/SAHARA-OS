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

test("lead modal: name, mobile, required date, GPS + area fallback, notes; dynamic CTA; returns a Lead ID; alerts in the background", () => {
  const m = readFileSync("src/components/public/bhk-price-cards.tsx", "utf8");
  for (const f of ['name="name"', 'name="mobile"', 'name="date"', 'name="area"', 'name="notes"', "navigator.geolocation", "Use current location", "leadId", "Confirm Your Booking", "Request Inspection / Submit Inquiry", "Please choose your preferred date."]) assert.ok(m.includes(f), f);
  const api = readFileSync("src/app/api/leads/submit/route.ts", "utf8");
  assert.match(api, /leadId/);
  assert.match(api, /void sendEmail\(/, "management e-mail never blocks the response");
});

test("header (app-like): logo left, pulsing Call Now / WhatsApp Us, sidebar hamburger; no printed phone numbers", () => {
  const h = readFileSync("src/components/public/mega-menu.tsx", "utf8");
  for (const f of ["sahara-wave-call", "sahara-wave-wa", "Call Now", "WhatsApp Us", "<SidebarMenu"]) assert.ok(h.includes(f), f);
  assert.doesNotMatch(h, /\{fmt\(|\+91 \$\{|\d{5} \d{5}/, "no visible phone numbers in the header");
  assert.doesNotMatch(h, /<details key=/, "no nested accordions in the mobile menu");
});

test("homepage order: hero → Google rating → client marquee → About → 4 cards → combo swiper → branches; no price cards / inspection / relocation", () => {
  const home = readFileSync("src/components/public/home-page.tsx", "utf8");
  const order = ["<HomeHeroSlider", "<GoogleRatingBadge", "<ClientMarquee", 'id="about-title"', "<HomeServiceDrill", "<ComboSwiper", "<BranchDetails"].map((x) => home.indexOf(x));
  for (const i of order) assert.ok(i > 0);
  assert.deepEqual([...order].sort((x, y) => x - y), order, "sections in the owner's order");
  for (const gone of ["<HomeBhkPriceCards", "<InspectionFlow", "<CategoryGrid", "Relocation", "<Faqs"]) assert.ok(!home.includes(gone), `${gone} is off the homepage`);
  const slider = readFileSync("src/components/public/home-hero-slider.tsx", "utf8");
  assert.match(slider, /snap-x snap-mandatory/, "native touch swipe");
  assert.doesNotMatch(slider, /<h1|<h2|<p\b/, "hero slides carry no overlay text");
  const drill = readFileSync("src/components/public/home-service-drill.tsx", "utf8");
  for (const f of ["1 BHK", "4 BHK", "Bungalow / Villa", "Move-in / Move-out", "Post-Construction", "Interior Painting", "Pest Control"]) assert.ok(drill.includes(f), f);
});

test("branches + footer: new Mohammadwadi address, no map buttons, single GSTIN, WhatsApp in socials", () => {
  const blocks = readFileSync("src/components/public/catalog-blocks.tsx", "utf8");
  const kit = readFileSync("src/components/public/landing-kit.tsx", "utf8");
  const footer = kit.slice(kit.indexOf("export function SiteFooter"), kit.indexOf("Mobile bottom bar for /booking"));
  assert.match(readFileSync("src/config/pune-seo-matrix.ts", "utf8"), /streetAddress: "Anand Nagar, Tarwade Vasti, Hadapsar"/);
  for (const src of [footer, blocks.slice(blocks.indexOf("export function BranchDetails"))]) assert.doesNotMatch(src.slice(0, 3000), /Google Maps|maps\.google|FaGoogle/);
  assert.equal(footer.split("COMPANY.gstin").length - 1, 1, "GSTIN once");
  assert.doesNotMatch(footer, /TRUST\.rating/, "no duplicate rating card");
  assert.match(footer, /<FooterSocial withWhatsApp \/>/);
  assert.match(readFileSync("src/components/public/footer-social.tsx", "utf8"), /FaWhatsapp/);
});

test("service pages: zonal accordion instead of scattered area tags", () => {
  const page = readFileSync("src/app/(public)/services/[category]/page.tsx", "utf8");
  assert.match(page, /<ZoneAccordion/);
  assert.doesNotMatch(page, /rounded-full bg-\[#eef3fb\] px-3 py-1 font-medium text-primary/, "no pill-style area tags");
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
