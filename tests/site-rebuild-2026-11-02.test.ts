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
  for (const name of ["Full House Deep Cleaning", "Unfurnished Home Cleaning", "Move-in / Move-out Cleaning", "Post-Interior Cleaning", "Pest Control", "Interior Painting", "Kitchen Deep Cleaning", "Bathroom Scrubbing", "Sofa & Upholstery Shampooing", "Carpet Cleaning", "Window Cleaning", "Balcony Cleaning", "Office Cleaning", "Showroom Cleaning", "Warehouse Cleaning", "Facade & Glass Cleaning", "Commercial Kitchen / Restaurant Cleaning", "Post-Construction Cleaning", "Commercial AMC & Facility Management", "Packers & Movers", "Rent Agreement & Police Verification", "Property Snagging / Home Inspection"]) {
    assert.ok(CATALOG_SERVICES.some((s) => s.name === name), `missing ${name}`);
  }
});

test("catalog pricing: fixed only where the pricing master has a rate; B2B, painting, post-construction and relocation on inspection", () => {
  for (const s of CATALOG_SERVICES) {
    if (s.category === "commercial" || s.category === "relocation" || /paint|post-/.test(s.slug)) assert.equal(s.pricing.mode, "inspection", s.slug);
    for (const id of s.pricing.contentIds ?? []) assert.ok(PRICING_MASTER.some((p) => p.contentId === id), `${s.slug}: unknown price id ${id}`);
    if (s.seoCategory) assert.ok(SERVICE_CATEGORIES.some((c) => c.slug === s.seoCategory), `${s.slug}: unknown seo category`);
  }
  assert.equal(catalogServiceBySlug("home-deep-cleaning")?.pricing.mode, "bhk");
  assert.equal(catalogServiceBySlug("pest-control")?.pricing.mode, "pest");
  // No price is ever hard-coded in the catalog.
  assert.doesNotMatch(readFileSync("src/config/service-catalog.ts", "utf8"), /₹\s?\d/);
});

test("lead modal: name, mobile, required date, GPS + area fallback, notes; dynamic CTA; returns a Lead ID; alerts in the background", () => {
  const m = readFileSync("src/components/public/quick-booking-modal.tsx", "utf8");
  for (const f of ['name="name"', 'name="mobile"', 'name="area"', 'name="notes"', "navigator.geolocation", "📍 Use current location (optional)", "leadId", "Confirm Your Booking", "Request Inspection / Submit Inquiry", "Please choose your preferred date.", "Please choose a time slot.", "visualViewport", "getDateAvailability(30)", "getSlotAvailability(date)", "publicBookLead(", "Available", "Filling Fast", "Fully Booked", "Your Booking Has Been Confirmed!", "Chat on WhatsApp for Instant Updates"]) assert.ok(m.includes(f), f);
  // Never tell a customer a slot is confirmed unless the CRM auto-confirmed it into a Job.
  assert.match(m, /ok\.status === "CONFIRMED" \? "confirmed" : "received"/);
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

test("homepage exact order: hero → slogan + Google badge → About → client marquee → 4 cards → combos → zone grid → branches", () => {
  const home = readFileSync("src/components/public/home-page.tsx", "utf8");
  const order = ["<HomeHeroSlider", "Pune&apos;s #1 Trusted Home Service Partner", "<GoogleRatingBadge", 'id="about-title"', "<ClientMarquee", "<HomeServiceCards", "<ComboSwiper", "<ZoneGrid", "<BranchDetails"].map((x) => home.indexOf(x));
  for (const i of order) assert.ok(i > 0);
  assert.deepEqual([...order].sort((x, y) => x - y), order, "sections in the owner's order");
  for (const gone of ["<HomeBhkPriceCards", "<InspectionFlow", "<CategoryGrid", "Relocation", "<Faqs"]) assert.ok(!home.includes(gone), `${gone} is off the homepage`);
  const slider = readFileSync("src/components/public/home-hero-slider.tsx", "utf8");
  assert.match(slider, /snap-x snap-mandatory/, "native touch swipe");
  assert.doesNotMatch(slider, /<h1|<h2|<p\b/, "hero slides carry no overlay text");
  const blocks = readFileSync("src/components/public/catalog-blocks.tsx", "utf8");
  const cards = blocks.slice(blocks.indexOf("export function HomeServiceCards"), blocks.indexOf("export function ZoneGrid"));
  for (const f of ['servicePath("home-deep-cleaning")', 'categoryPath("individual")', 'servicePath("interior-painting")', 'servicePath("pest-control")', "<Link href={c.href}"]) assert.ok(cards.includes(f), f);
  assert.doesNotMatch(cards, /From ₹|inr\(/, "no price tags on the homepage cards");
  const grid = blocks.slice(blocks.indexOf("export function ZoneGrid"));
  assert.doesNotMatch(grid, /pins/, "zone grid shows no PIN codes");
});

test("inner pages: no GST blocks; window ₹300 per window; balcony split out", async () => {
  const blocks = readFileSync("src/components/public/catalog-blocks.tsx", "utf8");
  const calc = readFileSync("src/components/public/rate-calculators.tsx", "utf8");
  for (const src of [blocks, calc, readFileSync("src/config/service-catalog.ts", "utf8")]) assert.doesNotMatch(src, /GST &amp; terms|18% GST|PUBLIC_GST_NOTE/);
  const { PRICING_MASTER } = await import("../src/lib/pricing-master");
  const win = PRICING_MASTER.find((p) => p.contentId === "SCS-30")!;
  assert.equal(win.price, 300); assert.equal(win.unit, "per window");
  assert.ok(PRICING_MASTER.some((p) => p.name === "Balcony Cleaning"));
  assert.ok(catalogServiceBySlug("window-cleaning") && catalogServiceBySlug("balcony-cleaning"));
  assert.match(calc, /Choose a treatment/, "pest: visual treatment cards before rates");
});

test("clients: official list, BHEL removed", async () => {
  const { CLIENT_NAMES } = await import("../src/lib/client-logos");
  assert.deepEqual([...CLIENT_NAMES], ["Renom Technologies", "Eaton Technologies", "BMW", "Clover Hills", "ABIL", "National Insurance", "Panther Nails", "Gagan Developers", "Leisure Town", "Padam Interiors", "Studio XP", "Manav Group", "Hawa Valves", "Famic Technologies"]);
  assert.ok(!(CLIENT_NAMES as readonly string[]).some((n) => /bhel/i.test(n)));
});

test("pest control: flat 1–4 BHK rates for all five treatments; 1 BHK = owner-stated starting price", async () => {
  const { PEST_BHK_RATES, PEST_BHK_SIZES } = await import("../src/lib/pricing-master");
  assert.deepEqual([...PEST_BHK_SIZES], ["1 BHK", "2 BHK", "3 BHK", "4 BHK"]);
  assert.deepEqual(PEST_BHK_RATES.map((r) => r.name), ["Cockroach & Ant Control", "Bed Bug Control", "Rodent Control", "Termite Control", "Mosquito Control"]);
  const first = Object.fromEntries(PEST_BHK_RATES.map((r) => [r.name, r.rates["1 BHK"]]));
  assert.equal(first["Cockroach & Ant Control"], 999);
  assert.equal(first["Bed Bug Control"], 1199);
  assert.equal(first["Rodent Control"], 1499);
  assert.equal(first["Termite Control"], 2499);
  for (const r of PEST_BHK_RATES) for (let i = 1; i < PEST_BHK_SIZES.length; i++) assert.ok(r.rates[PEST_BHK_SIZES[i]] >= r.rates[PEST_BHK_SIZES[i - 1]], `${r.name} rises with home size`);
});

test("landing pages: calculator, scope (included / excluded / GST), zone table for every service; category pages exist", () => {
  const page = readFileSync("src/app/(public)/services/[category]/page.tsx", "utf8");
  const svc = page.slice(page.indexOf("async function CatalogServicePage"), page.indexOf("async function CatalogCategoryPage"));
  for (const f of ["<ServicePricing", "<ScopeOfWork", "<ZoneAccordion", 'href="#book"']) assert.ok(svc.includes(f), f);
  assert.match(page, /catalogCategoryBySlug\(slug\)/);
  const calc = readFileSync("src/components/public/rate-calculators.tsx", "utf8");
  for (const f of ["export function PackageCalculator", "export function QtyCalculator", "export function PestCalculator", "Bungalow / Villa", "Unfurnished", "Post-Interior Cleaning", "Not included"]) assert.ok(calc.includes(f), f);
});

test("sidebar + footer: no Our Work / Areas links; Blog + Contact; footer = 4 category columns, no branch blocks or rating card", () => {
  const side = readFileSync("src/components/public/sidebar-menu.tsx", "utf8");
  assert.doesNotMatch(side, /Our Work|Areas We Serve/);
  assert.match(side, /href="\/blog"/);
  assert.match(side, /href="\/contact"/);
  const kit = readFileSync("src/components/public/landing-kit.tsx", "utf8");
  const footer = kit.slice(kit.indexOf("export function SiteFooter"), kit.indexOf("Mobile bottom bar for /booking"));
  assert.match(footer, /md:grid-cols-4/);
  assert.doesNotMatch(footer, /Branch|streetAddress|TRUST\.rating|Google Maps/);
  assert.equal(footer.split("COMPANY.gstin").length - 1, 1, "GSTIN once");
  // Final sprint 2026-11-02: Google review link replaces the WhatsApp icon; Scope of Work link removed.
  assert.match(footer, /<FooterSocial withGoogleReview \/>/);
  assert.doesNotMatch(footer, /scope-of-work/);
  assert.match(readFileSync("src/components/public/footer-social.tsx", "utf8"), /https:\/\/g\.page\/r\/CYJ9szEiGaN4EBE\/review/);
  assert.match(readFileSync("src/config/pune-seo-matrix.ts", "utf8"), /streetAddress: "Anand Nagar, Tarwade Vasti, Hadapsar"/);
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
