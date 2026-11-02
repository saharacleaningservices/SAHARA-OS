import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? pages(p) : n === "page.tsx" ? [p] : [];
  });
}

test("no page that reads the database is prerendered at build time (Coolify's Docker build has no database)", () => {
  // 2026-11-01: PR #89/#90 deployments failed in Coolify with "Cannot open database because the directory does not exist"
  // while prerendering /b2b/architects. Every page that loads Company Settings must render per request.
  const offenders = pages("src/app").filter((p) => {
    if (p.includes("(app)")) return false; // signed-in CRM pages read the session cookie, so they are never prerendered
    const src = readFileSync(p, "utf8");
    if (/getSession|requireSession|requireUser|cookies\(|headers\(|searchParams/.test(src)) return false; // request-bound → dynamic anyway
    const readsDb = /getCompanySettings|getPublicPricing|from "@\/lib\/db"/.test(src) || /<(LandingShell|HomePage|B2BPage)\b/.test(src);
    return readsDb && !/export const dynamic = "force-dynamic"/.test(src);
  });
  assert.deepEqual(offenders, []);
});

test("standalone homepage: '/' renders the public homepage on the website hosts, CRM elsewhere", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /<HomePage \/>/);
  assert.doesNotMatch(page, /booking\/checkout/, "the homepage never routes to a checkout");
  assert.match(page, /redirect\("\/dashboard"\)/);
  assert.match(page, /MAIN_HOST/);
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.match(mw, /if \(pathname === "\/"\) return NextResponse\.next\(\);/);
  assert.doesNotMatch(mw, /url\.pathname = "\/booking";/, "the booking host no longer bounces / to /booking");
  const home = readFileSync("src/components/public/home-page.tsx", "utf8");
  // Rebuild 2026-11-02: hero slider → 4-category grid → BHK cards → combos → inspection flow → work gallery → trust → areas → FAQ.
  // App-like homepage (owner 2026-11-02): order and purges are asserted in tests/site-rebuild-2026-11-02.test.ts.
  for (const part of ["<HomeHeroSlider", "<GoogleRatingBadge", "<ClientMarquee", "<HomeServiceCards", "<ComboSwiper", "<BranchDetails"]) assert.match(home, new RegExp(part));
  // The lead modal is mounted once per page by LandingShell, so every Book button on every page opens it.
  assert.match(readFileSync("src/components/public/landing-kit.tsx", "utf8"), /<LeadModal /);
  assert.doesNotMatch(home, /BookingWizard|id="book"|checkout/, "the homepage never holds the booking form or routes to a checkout");
  assert.doesNotMatch(home, /cognito|<iframe|FestivalZoneEffects/i);
});

test("sitemap includes the homepage", async () => {
  const { SITEMAP_PATHS } = await import("../src/app/sitemap");
  assert.ok(SITEMAP_PATHS.includes("/"));
  assert.ok(SITEMAP_PATHS.includes("/contact"));
});

test("homepage BHK price cards: instant Premium/Platinum cards with inclusions, Book Now opens the same-page lead form", () => {
  const c = readFileSync("src/components/public/bhk-price-cards.tsx", "utf8");
  assert.match(c, /useState<\(typeof SIZES\)\[number\]>\("2 BHK"\)/, "2 BHK preselected: cards always rendered, no layout shift");
  assert.match(c, /"1 BHK", "2 BHK", "3 BHK", "4 BHK\+"/);
  assert.match(c, /inclusions\[tier\]/);
  // The shared booking modal lives in quick-booking-modal.tsx since 2026-11-02 (live CRM slots).
  const modal = readFileSync("src/components/public/quick-booking-modal.tsx", "utf8");
  assert.match(modal, /\/api\/leads\/submit/);
  for (const field of ['name="name"', 'name="mobile"', 'name="website"']) assert.ok(modal.includes(field), field);
  assert.doesNotMatch(c + modal, /BookingWizard|location\.href\s*=|router\.push/, "no wizard, no navigation");
  assert.match(readFileSync("src/components/public/service-cards.tsx", "utf8"), /openLead\(/);
});
