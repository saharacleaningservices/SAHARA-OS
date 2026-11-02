// Tagline unification (owner 2026-11-03) + /images/ served on the public host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BRAND_TAGLINE } from "../src/lib/brand-tagline";

const read = (f: string) => readFileSync(f, "utf8");
const T = "Your Trust. Our Expertise. Your Satisfaction.";

test("one official tagline everywhere: homepage, bill / quotation PDF, invoice PDF, shared PDF footer, vouchers, receipt, metadata, OG, schema", () => {
  assert.equal(BRAND_TAGLINE, T);
  // PDF modules cannot be imported in this runner (the PDF suites bundle them with esbuild); check the wiring in source, and the
  // rendered invoice text is covered by tests/pdf-brand-2026-10-25.test.mts plus the sample render done for this change.
  assert.match(read("src/lib/pdf/sahara-bill-document.tsx"), /export const SLOGAN = BRAND_TAGLINE;/);
  assert.match(read("src/lib/pdf/sahara-invoice-document.tsx"), /export const INVOICE_TAGLINE = BRAND_TAGLINE;/);
  assert.match(read("src/lib/pdf/brand-kit.tsx"), /\{BRAND_TAGLINE\}<\/Text>/, "BrandFooter (quotes, bills, invoices) prints it");
  assert.match(read("src/lib/pdf/voucher-document.tsx"), /\{BRAND_TAGLINE\}/);
  assert.match(read("src/app/booking/receipt/[token]/page.tsx"), /\{BRAND_TAGLINE\}/);
  const page = read("src/app/page.tsx");
  assert.match(page, /const DESC = `\$\{BRAND_TAGLINE\} /);
  assert.match(page, /title: OG_TITLE/);
  assert.match(page, /twitter: \{ card: "summary_large_image", title: OG_TITLE/);
  assert.match(read("src/lib/seo-schema.ts"), /slogan: BRAND_TAGLINE/);
  assert.doesNotMatch(read("src/lib/pdf/sahara-bill-document.tsx") + read("src/lib/pdf/sahara-invoice-document.tsx"), /Your Trusted Home Service Partner/);
});

test("public site serves /images/ (before/after photos from Claude Desktop need it): middleware static path + cache header", () => {
  assert.match(read("next.config.ts"), /STATIC_IMAGE_DIRS = \[[^\]]*"images"/);
  assert.match(read("src/middleware.ts"), /pathname\.startsWith\("\/images\/"\)/);
});

test("before/after: 16 WebP cards in one carousel (swipe, arrows, dots, 4 s autoplay), placed below Our Services / Combo packages", () => {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const files = readdirSync("public/images/before-after").filter((f: string) => f.endsWith(".webp"));
  assert.equal(files.length, 16);
  const comp = read("src/components/BeforeAfterSection.tsx");
  for (const f of files) assert.ok(comp.includes(`"${f.replace(/\.webp$/, "")}"`), `${f} is used by the component`);
  assert.match(comp, /width=\{265\} height=\{265\}/, "fixed card size → no layout shift");
  assert.match(comp, /h-\[265px\] w-\[265px\] shrink-0 snap-start/, "one swipeable row of fixed-size cards");
  assert.match(comp, /const AUTOPLAY_MS = 4000;/);
  assert.match(comp, /aria-label="Previous result"/);
  assert.match(comp, /aria-label="Next result"/);
  assert.match(comp, /aria-label=\{`Show result \$\{n \+ 1\}`\}/, "pagination dots");
  assert.match(comp, /new IntersectionObserver/, "autoplay only while on screen");
  assert.doesNotMatch(comp, /sahara-ba__grid|flex-wrap:wrap/, "no stacked grids any more");
  const home = read("src/components/public/home-page.tsx");
  const order = ["<HomeServiceCards", "<ComboSwiper", "<BeforeAfterSection", "<ZoneGrid"].map((x) => home.indexOf(x));
  assert.ok(order.every((n) => n > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("logo sliders: home, /services and both commercial pages mount the 13-logo slider", () => {
  assert.match(read("src/components/public/home-page.tsx"), /<ClientMarquee \/>/);
  assert.match(read("src/app/(public)/services/page.tsx"), /<ClientCarousel logos=\{CLIENT_LOGOS\}/);
  assert.match(read("src/app/(public)/services/[category]/page.tsx"), /c\.id === "commercial" && <PartnersMarquee \/>/);
  assert.match(read("src/app/commercial-cleaning/page.tsx"), /<PartnersMarquee \/>/);
});
