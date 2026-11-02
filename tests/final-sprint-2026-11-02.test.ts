// Final sprint (owner 2026-11-02): unfurnished matrix, checkout add-on chips, Zone B PIN-code MOV, combo up-sell, clean image
// registry, schema types, footer, PIN codes hidden from the UI, tracking payload, compositor-only header animation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PRICING_MASTER, comboSavings } from "../src/lib/pricing-master";
import { CHECKOUT_CHIP_IDS, MOQ_VALUE, ZONE_B_MOV_MESSAGE, ZONE_B_PINCODES, isZoneBPincode, minimumOrderFor, moqFor, upgradeBundle, type AddOn } from "../src/lib/zonal-moq";
import { IMAGE_REGISTRY, TEXT_BAKED_PATTERNS } from "../src/config/image-registry";
import { CATALOG_SERVICES } from "../src/config/service-catalog";
import { buildBusinessJsonLd } from "../src/lib/seo-schema";
import { LOCALITIES, categoryBySlug, localityBySlug } from "../src/config/pune-seo-matrix";
import { localIntro, pageFaqs, seoDescription, seoTitle } from "../src/lib/seo-copy";

const byId = (id: string) => PRICING_MASTER.find((p) => p.contentId === id);
const read = (f: string) => readFileSync(f, "utf8");

test("unfurnished flat matrix: 1/2/3 BHK at 3,199 / 3,899 / 4,599, no 4 BHK", () => {
  assert.equal(byId("SCS-UF-1")?.price, 3199);
  assert.equal(byId("SCS-UF-2")?.price, 3899);
  assert.equal(byId("SCS-UF-3")?.price, 4599);
  const uf = PRICING_MASTER.filter((p) => p.group === "UNFURNISHED");
  assert.equal(uf.length, 3);
  assert.ok(uf.every((p) => p.category === "HOME_DEEP_CLEANING" && p.bhk));
  assert.ok(!uf.some((p) => p.bhk === "4 BHK"));
  assert.equal(CATALOG_SERVICES.find((s) => s.slug === "unfurnished-home-cleaning")?.pricing.mode, "unfurnished");
});

test("checkout chips: Fridge 499, Chimney 699, Pest Control Shot 899, Balcony 499", () => {
  assert.deepEqual([...CHECKOUT_CHIP_IDS], ["SCS-32", "SCS-35", "SCS-36", "SCS-34"]);
  assert.deepEqual(CHECKOUT_CHIP_IDS.map((id) => byId(id)?.price), [499, 699, 899, 499]);
  assert.equal(byId("SCS-36")?.addOnOnly, true, "pest shot is add-on only");
});

test("Zone B PIN codes: owner list gated at ₹3,999; PIN wins over area; pest excluded", () => {
  for (const pin of ["411057", "411045", "411007", "411038", "411058", "411041", "411019", "411033"]) assert.ok(isZoneBPincode(pin), pin);
  assert.ok((ZONE_B_PINCODES as readonly string[]).includes("411057"));
  assert.ok(!isZoneBPincode("411028"), "Magarpatta is Zone A");
  assert.equal(moqFor({ locality: "magarpatta", pincode: "411045" }).moq, MOQ_VALUE);
  assert.equal(moqFor({ locality: "magarpatta", pincode: "411028" }).moq, 0);
  assert.equal(moqFor({ locality: "baner" }).moq, MOQ_VALUE);
  assert.equal(minimumOrderFor({ serviceCategory: "PEST_CONTROL", pincode: "411057" }), 0);
  assert.equal(minimumOrderFor({ serviceCategory: "HOME_DEEP_CLEANING", pincode: "411057" }), MOQ_VALUE);
  assert.equal(minimumOrderFor({ serviceCategory: "INDIVIDUAL_CLEANING", locality: "Sinhagad Road" }), MOQ_VALUE);
  assert.equal(minimumOrderFor({ serviceCategory: "INDIVIDUAL_CLEANING", locality: "Hadapsar", pincode: "411028" }), 0);
  assert.equal(ZONE_B_MOV_MESSAGE, "Zone B (West Pune/PCMC) requires a Minimum Order Value of ₹3,999.");
});

test("1-click upgrade bundle closes the gap with the fewest add-ons", () => {
  const chips: AddOn[] = CHECKOUT_CHIP_IDS.map((id) => ({ contentId: id, name: byId(id)!.name, price: byId(id)!.price!, minQty: 1 }));
  // 2 BHK unfurnished ₹3,899 → gap ₹100 → one ₹499 chip.
  const a = upgradeBundle(3999 - 3899, chips);
  assert.equal(a.length, 1);
  assert.ok(a[0].price >= 100);
  // 1 BHK unfurnished ₹3,199 → gap ₹800 → a single chip ≥ 800 (pest shot ₹899).
  const b = upgradeBundle(3999 - 3199, chips);
  assert.equal(b.reduce((t, x) => t + x.price, 0) >= 800, true);
  // Gap larger than all chips together → no chip bundle (caller falls back to combos).
  assert.deepEqual(upgradeBundle(5000, chips), []);
});

test("combo up-sell only shows genuine savings", () => {
  const deals = comboSavings(PRICING_MASTER);
  for (const d of deals) assert.ok(d.saving > 0 && d.separate > d.combo.price!);
  // Kitchen ₹1,999 + 2 bathrooms ₹1,198 + fridge ₹499 = ₹3,696 > ₹3,499 combo.
  const k = deals.find((d) => d.combo.contentId === "SCS-26");
  assert.ok(k && k.saving === 3696 - 3499);
  // Kitchen + 3 bathrooms separately (₹3,796) is cheaper than the ₹3,999 combo → never advertised as a saving.
  assert.ok(!deals.some((d) => d.combo.contentId === "SCS-27"));
});

test("booking server enforces the Zone B minimum and add-on-only rule", () => {
  const core = read("src/server/public-booking-core.ts");
  assert.match(core, /minimumOrderFor\(\{ serviceCategory: data\.serviceCategory, pincode: data\.pinCode, locality: data\.area \}/);
  assert.match(core, /code: "MIN_ORDER"/);
  assert.match(core, /item\.addOnOnly/);
  const modal = read("src/components/public/quick-booking-modal.tsx");
  assert.match(modal, /Add Add-on \/ Upgrade to \{inr\(MOQ_VALUE\)\} Combo/);
  assert.match(modal, /pinCode: pin/);
  assert.match(modal, /ZONE_B_MOV_MESSAGE/);
});

test("image registry: new clean photos exist, mapped to their services, none text-baked; pest & painting unchanged", () => {
  for (const [k, v] of Object.entries(IMAGE_REGISTRY)) {
    assert.ok(existsSync(path.join("public", v.src)), `${k} → ${v.src} missing`);
    assert.ok(!TEXT_BAKED_PATTERNS.some((re) => re.test(v.src)), `${k} is text-baked`);
  }
  assert.equal(IMAGE_REGISTRY["full-home"].src, "/marketing/services/full-home-crew.webp");
  assert.equal(IMAGE_REGISTRY.bathroom.src, "/marketing/services/bathroom-scrub.webp");
  assert.equal(IMAGE_REGISTRY.kitchen.src, "/marketing/services/kitchen-chimney.webp");
  assert.equal(IMAGE_REGISTRY.express.src, "/marketing/services/express-cleaning.webp");
  assert.equal(IMAGE_REGISTRY.pest.src, "/marketing/service-pest-control.webp");
  assert.equal(IMAGE_REGISTRY.painting.src, "/marketing/service-painting.webp");
  const svc = (slug: string) => CATALOG_SERVICES.find((s) => s.slug === slug)!.image;
  assert.equal(svc("home-deep-cleaning"), IMAGE_REGISTRY["full-home"].src);
  assert.equal(svc("bathroom-deep-cleaning"), IMAGE_REGISTRY.bathroom.src);
  assert.equal(svc("kitchen-deep-cleaning"), IMAGE_REGISTRY.kitchen.src);
  assert.equal(svc("window-cleaning"), IMAGE_REGISTRY.window.src);
  assert.equal(svc("post-construction-cleaning"), IMAGE_REGISTRY["post-construction"].src);
});

test("schema: LocalBusiness + ProfessionalService + HomeAndConstructionBusiness, 4.9 / 1,830 rating, geo, second branch", () => {
  const j = buildBusinessJsonLd() as Record<string, unknown> & { aggregateRating: { ratingValue: string; ratingCount: number }; geo: { latitude: number }; department: { "@id": string } };
  assert.deepEqual(j["@type"], ["LocalBusiness", "ProfessionalService", "HomeAndConstructionBusiness"]);
  assert.equal(j.aggregateRating.ratingValue, "4.9");
  assert.equal(j.aggregateRating.ratingCount, 1830);
  assert.ok(j.geo.latitude > 18);
  assert.match(j.department["@id"], /#branch-mohammadwadi$/);
});

test("raw PIN codes never appear in visible SEO copy", () => {
  const c = categoryBySlug("kitchen-bathroom-cleaning")!;
  for (const l of LOCALITIES) {
    const text = [seoTitle(c, l), seoDescription(c, l), localIntro(c, l), ...pageFaqs(c, l).map((f) => `${f.q} ${f.a}`)].join(" ");
    for (const pin of l.pins) assert.ok(!text.includes(pin), `${l.slug}: ${pin} visible`);
  }
  assert.equal(seoTitle(categoryBySlug("sofa-carpet-mattress-cleaning")!, localityBySlug("wakad")!).startsWith("Sofa, Carpet & Mattress Cleaning in Wakad"), true);
  assert.doesNotMatch(read("src/components/public/catalog-blocks.tsx"), /l\.pins\.join/);
});

test("footer: Google review link instead of WhatsApp, no Scope of Work link", () => {
  const kit = read("src/components/public/landing-kit.tsx");
  const footer = kit.slice(kit.indexOf("export function SiteFooter"), kit.indexOf("Mobile bottom bar for /booking"));
  assert.match(footer, /<FooterSocial withGoogleReview \/>/);
  assert.doesNotMatch(footer, /Scope of Work/);
  assert.match(read("src/components/public/footer-social.tsx"), /https:\/\/g\.page\/r\/CYJ9szEiGaN4EBE\/review/);
});

test("tracking: dataLayer push carries value, currency, transaction_id and the shared event id", () => {
  const tags = read("src/components/public/marketing-tags.tsx");
  assert.match(tags, /event: "lead_form_submit"[^\n]*value:[^\n]*currency: "INR"[^\n]*transaction_id[^\n]*event_id: eventId/);
  assert.match(tags, /event: "booking_confirmed"/);
  assert.match(tags, /\{ eventID: eventId \}/, "Pixel and CAPI share one event id");
  assert.match(read("src/components/public/quick-booking-modal.tsx"), /trackSchedule\(/);
});

test("performance: header wave rings animate transform/opacity only (no box-shadow repaint)", () => {
  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("@keyframes sahara-wave "), css.indexOf("/* Client logo marquee"));
  assert.doesNotMatch(block, /box-shadow/);
  assert.match(block, /transform: scale/);
});
