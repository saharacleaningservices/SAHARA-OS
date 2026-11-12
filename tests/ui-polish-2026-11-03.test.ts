// UI polish round (owner 2026-11-03): hero speed, compact heroes, tagline, card crops, optional PIN, menu, package tabs,
// transparent client-logo pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAND_TAGLINE } from "../src/lib/brand-tagline";
import { existsSync, readFileSync } from "node:fs";
import { NAV_MEGA } from "../src/config/nav-menu";
import { CATALOG_SERVICES } from "../src/config/service-catalog";
import { IMAGE_REGISTRY } from "../src/config/image-registry";
import { moqFor, MOQ_VALUE } from "../src/lib/zonal-moq";
import { LOCALITIES } from "../src/config/pune-seo-matrix";

const read = (f: string) => readFileSync(f, "utf8");

test("hero slider: 2.5 s per slide, 300 ms slide animation, shorter on phones", () => {
  const s = read("src/components/public/home-hero-slider.tsx");
  assert.match(s, /const ROTATE_MS = 2500;/);
  assert.match(s, /const SLIDE_MS = 300;/);
  assert.match(s, /aspect-\[16\/10\]/);
  assert.doesNotMatch(s, /behavior: "smooth"/, "native smooth scroll has no fixed duration");
});

test("service heroes: compact on mobile; Sofa, Painting and Pest Control carry short hero copy", () => {
  for (const slug of ["sofa-upholstery-cleaning", "interior-painting", "pest-control"]) {
    const s = CATALOG_SERVICES.find((x) => x.slug === slug)!;
    assert.ok(s.heroIntro && s.heroIntro.length <= 70, `${slug} hero intro too long`);
    assert.ok(s.heroPoints && s.heroPoints.length <= 3 && s.heroPoints.every((p) => p.length <= 30), `${slug} hero points too long`);
  }
  const hero = read("src/components/public/category-landing.tsx");
  assert.match(hero, /px-4 py-4 sm:py-10/);
  assert.match(hero, /line-clamp-2/);
});

test("homepage headline (owner 2026-11-03, replaces the #1 tagline): Your Trust. Our Expertise. Your Satisfaction.", () => {
  assert.match(read("src/components/public/home-page.tsx"), /<h1[^>]*>\{BRAND_TAGLINE\}<\/h1>/);
  assert.equal(BRAND_TAGLINE, "Your Trust. Our Expertise. Your Satisfaction.");
});

test("Full House and Individual cards use the re-cropped 4:3 photos", () => {
  assert.equal(IMAGE_REGISTRY["full-home"].src, "/marketing/services/full-home-card.webp");
  assert.equal(IMAGE_REGISTRY.express.src, "/marketing/services/express-card.webp");
  for (const k of ["full-home", "express"] as const) assert.ok(existsSync(`public${IMAGE_REGISTRY[k].src}`));
});

test("booking drawer: PIN code optional; area alone books; Zone B minimum still applies by area", () => {
  const m = read("src/components/public/quick-booking-modal.tsx");
  assert.match(m, /placeholder="PIN \(optional\)"/);
  assert.doesNotMatch(m, /name="pincode"[^>]*required/);
  assert.match(m, /if \(pin\.length > 0 && pin\.length !== 6\)/);
  const WEST = LOCALITIES.filter((l) => l.zone === "west-pcmc").map((l) => l.slug);
  for (const area of ["baner", "wakad", "hinjewadi"]) assert.equal(moqFor({ locality: area, pincode: "" }, WEST).moq, MOQ_VALUE, area);
  assert.equal(moqFor({ locality: "hadapsar", pincode: "" }, WEST).moq, 0);
});

test("menu: no Move-in / Move-out under Residential; Housekeeping Services under Commercial; dark-blue bottom panel", () => {
  const res = NAV_MEGA.find((m) => m.id === "residential")!;
  assert.ok(!res.items.some((i) => /Move-in/.test(i.label)));
  const com = NAV_MEGA.find((m) => m.id === "commercial")!;
  assert.ok(com.items.some((i) => i.label === "Housekeeping Services" && i.href === "/housekeeping-services"));
  assert.ok(CATALOG_SERVICES.some((s) => s.slug === "move-in-move-out-cleaning"), "the page itself stays live");
  const side = read("src/components/public/sidebar-menu.tsx");
  assert.match(side, /bg-\[#0a2540\] px-3 pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\] pt-3 text-white/);
  assert.match(side, /border-b border-\[#0a2540\]\/10 bg-white px-5/);
});

test("package tabs: Regular · Unfurnished · Post-Interior Cleaning", () => {
  const c = read("src/components/public/rate-calculators.tsx");
  assert.match(c, /export const OCCASIONS = \["Regular", "Unfurnished", "Post-Interior Cleaning"\] as const;/);
  assert.doesNotMatch(c, /"Move-in \/ Move-out"|"Post-Construction"/);
  assert.match(read("src/components/public/catalog-blocks.tsx"), /i\.group === "UNFURNISHED"/);
});

test("client logos: converter outputs transparent PNG-24; strip swaps name tiles for logos", () => {
  const py = read("scripts/convert-client-logos.py");
  assert.match(py, /\.convert\("RGBA"\)/);
  assert.match(py, /img\.save\(out, "PNG"/);
  const blocks = read("src/components/public/catalog-blocks.tsx");
  assert.match(blocks, /const logoFor = \(n: string\) => CLIENT_LOGOS\.find/);
});

test("client logos: 13 transparent PNG-24 files, every logo matches a client name", async () => {
  const { CLIENT_LOGOS, CLIENT_NAMES } = await import("../src/lib/client-logos");
  assert.equal(CLIENT_LOGOS.length, 13);
  for (const l of CLIENT_LOGOS) {
    assert.ok((CLIENT_NAMES as readonly string[]).includes(l.name), l.name);
    const buf = readFileSync(`public${l.src}`);
    assert.equal(buf.toString("ascii", 1, 4), "PNG", l.src);
    assert.equal(buf[25], 6, `${l.src} must be RGBA (PNG colour type 6)`);
  }
});

test("client logo folder is served on the public website host (middleware static path + cache header)", () => {
  assert.match(read("src/middleware.ts"), /pathname\.startsWith\("\/clients\/"\)/);
  assert.match(read("next.config.ts"), /STATIC_IMAGE_DIRS = \[[^\]]*"clients"/);
});
