// Final layout round (owner 2026-11-03): hero cap + timing, compact trust card, header without CTA buttons, floating contact button,
// About + stats grid, expansion banner, real-work showcase, Padams Interiors, logos on every slider. YouTube stays out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABOUT_STATS, SHOWCASE_CATEGORIES } from "../src/components/public/home-sections";
import { CLIENT_LOGOS, CLIENT_NAMES } from "../src/lib/client-logos";

const read = (f: string) => readFileSync(f, "utf8");
/** Source without comments, so a note about a removed feature cannot fail a "must not contain" check. */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("hero slider: 2.5 s autoplay, 300 ms slide, desktop cap min(500px, 50vh) with object-cover object-center", () => {
  const s = read("src/components/public/home-hero-slider.tsx");
  assert.match(s, /const ROTATE_MS = 2500;/);
  assert.match(s, /const SLIDE_MS = 300;/);
  assert.match(s, /lg:max-h-\[min\(500px,50vh\)\]/);
  assert.match(s, /object-cover object-center/);
});

test("trust card: vertical padding cut ~35% (20px → 13px) and tighter rating spacing", () => {
  const h = read("src/components/public/home-page.tsx");
  assert.match(h, /px-4 py-\[13px\] text-center shadow-md/);
  assert.match(h, /<div className="mt-2"><GoogleRatingBadge/);
  assert.match(h, /<h1 id="slogan"[^>]*>Your Trust\. Our Expertise\. Your Satisfaction\.<\/h1>/);
  assert.doesNotMatch(h, /#1 Trusted Home Service Partner/);
});

test("header has no Call Now / WhatsApp Us; one floating contact button with a call + WhatsApp pop-up", () => {
  const header = code("src/components/public/mega-menu.tsx");
  assert.doesNotMatch(header, /Call Now|WhatsApp Us/);
  const fab = read("src/components/public/floating-contact.tsx");
  assert.match(fab, /fixed bottom-20 right-4/);
  assert.match(fab, /aria-expanded=\{open\}/);
  assert.match(fab, /tel:\+91/);
  assert.match(fab, /wa\.me\/91/);
  assert.doesNotMatch(fab, /from "next\/image"|framer|motion|swiper/, "stays dependency-free");
  assert.match(read("src/components/public/landing-kit.tsx"), /<FloatingContact /);
  assert.match(read("src/components/public/category-landing.tsx"), /export function StickyWhatsApp\(_props[^)]*\) \{\s*return null;/, "old sticky WhatsApp retired so only one floating button exists");
  const css = read("src/app/globals.css");
  const ring = css.slice(css.indexOf("@keyframes sahara-fab-ring"), css.indexOf("@keyframes sahara-fab-ring") + 140);
  assert.doesNotMatch(ring, /box-shadow/);
});

test("About Us: no locality names; Pune & PCMC, 25+ years, 8,000+ clients; 4 stat cards 2x2 → 1x4", () => {
  const h = read("src/components/public/home-page.tsx");
  const about = h.slice(h.indexOf('aria-labelledby="about-title"'), h.indexOf("<ExpansionBanner"));
  assert.doesNotMatch(about, /Magarpatta|Mohammadwadi/);
  assert.match(about, /Pune &amp; PCMC/);
  assert.match(about, /25\+ years of combined industry experience and 8,000\+ satisfied clients/);
  assert.deepEqual(ABOUT_STATS.map((s) => [s.label, s.value, s.sub]), [
    ["Established", "2012", "Since 2012"],
    ["Customers Served", "8,000+", "Homes & Offices"],
    ["Combined Expertise", "25+ Years", "Industry experience"],
    ["Professional Team", "20+", "In-House Crew"],
  ]);
  assert.match(read("src/components/public/home-sections.tsx"), /grid-cols-2 gap-2\.5 lg:grid-cols-4/);
});

test("homepage order: About → Expansion banner → Real work → Trusted by → services; text-only banner; no YouTube", () => {
  const h = read("src/components/public/home-page.tsx");
  const order = ["<AboutStats", "<ExpansionBanner", "<RealWorkShowcase", "<ClientMarquee", "<HomeServiceCards", "<ComboSwiper"].map((x) => h.indexOf(x));
  assert.ok(order.every((n) => n > 0), "all sections present");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const sec = read("src/components/public/home-sections.tsx");
  const banner = sec.slice(sec.indexOf("export function ExpansionBanner"), sec.indexOf("/** Which gallery categories"));
  assert.match(banner, /Coming soon to Mumbai &amp; Bangalore/);
  assert.match(banner, /sahara-fade-pulse/);
  assert.doesNotMatch(banner, /<img|<Image|<video/, "text only");
  assert.doesNotMatch(code("src/components/public/home-page.tsx") + code("src/components/public/home-sections.tsx"), /youtube|iframe/i);
  const css = read("src/app/globals.css");
  assert.doesNotMatch(css.slice(css.indexOf("@keyframes sahara-fade-pulse"), css.indexOf("@keyframes sahara-fade-pulse") + 120), /box-shadow|width|height/);
});

test("real-work showcase: only real CRM before/after pairs in kitchen, tile / bathroom and sofa categories; hidden when none", () => {
  const sec = read("src/components/public/home-sections.tsx");
  assert.deepEqual([...SHOWCASE_CATEGORIES], ["Kitchen & Bathroom", "Sofa & Carpet", "Home Deep Cleaning"]);
  assert.match(sec, /getFeaturedGallery\(/);
  assert.match(sec, /toBeforeAfterPairs\(/);
  assert.match(sec, /if \(pairs\.length === 0\) return null;/);
  assert.match(sec, /<BeforeAfterSlider /);
});

test("trusted-by: 13 logos, Padams Interiors spelling, on home, commercial and /services sliders", () => {
  assert.equal(CLIENT_LOGOS.length, 13);
  for (const n of ["BMW", "National Insurance", "Padams Interiors", "Panther Nails"]) {
    assert.ok(CLIENT_LOGOS.some((l) => l.name === n), n);
    assert.ok((CLIENT_NAMES as readonly string[]).includes(n), n);
  }
  const blocks = read("src/components/public/catalog-blocks.tsx");
  assert.match(blocks, /export function ClientMarquee/);
  assert.match(blocks, /export function PartnersMarquee\(\) \{\s*if \(CLIENT_LOGOS\.length > 0\) return <ClientCarousel/);
  assert.match(read("src/app/(public)/services/page.tsx"), /<ClientCarousel logos=\{CLIENT_LOGOS\}/);
});
