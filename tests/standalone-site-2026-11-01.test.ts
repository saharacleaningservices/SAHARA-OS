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
  assert.match(page, /redirect\(`\/booking\/checkout\?/);
  assert.match(page, /redirect\("\/dashboard"\)/);
  assert.match(page, /MAIN_HOST/);
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.match(mw, /if \(pathname === "\/"\) return NextResponse\.next\(\);/);
  assert.doesNotMatch(mw, /url\.pathname = "\/booking";/, "the booking host no longer bounces / to /booking");
  const home = readFileSync("src/components/public/home-page.tsx", "utf8");
  for (const part of ["FunnelCards checkoutBase", "CompactPriceSelector checkoutBase", "HomeAbout", "ReviewsCarousel", "ClientCarousel", "NAV_MEGA", "BranchCards", "CategoryHero", "Faqs"]) assert.match(home, new RegExp(part));
  assert.doesNotMatch(home, /BookingWizard|id="book"/, "the homepage never holds the booking form");
  assert.doesNotMatch(home, /cognito|<iframe|FestivalZoneEffects/i);
});

test("sitemap includes the homepage", async () => {
  const { SITEMAP_PATHS } = await import("../src/app/sitemap");
  assert.ok(SITEMAP_PATHS.includes("/"));
  assert.ok(SITEMAP_PATHS.includes("/contact"));
});

test("streamlined checkout: /booking/checkout holds the booking form with the BHK + package pre-filled, noindex", () => {
  const page = readFileSync("src/app/booking/checkout/page.tsx", "utf8");
  assert.match(page, /<BookingWizard/);
  assert.match(page, /preset=\{preset\}/);
  assert.match(page, /index: false/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  const sel = readFileSync("src/components/public/price-selector.tsx", "utf8");
  assert.match(sel, /checkoutBase/);
  assert.match(readFileSync("src/app/booking/page.tsx", "utf8"), /\/booking\/checkout\?/);
});
