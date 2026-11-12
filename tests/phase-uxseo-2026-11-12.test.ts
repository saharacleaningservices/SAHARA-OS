import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anchorPrice } from "../src/lib/savings";
import { PRICING_MASTER } from "../src/lib/pricing-master";
import { LOCALITIES, PROGRAMMATIC_PAGES, SERVICE_CATEGORIES } from "../src/config/pune-seo-matrix";
import { commonServiceFaqs } from "../src/lib/service-faqs";
import { parseFeaturedReviews, serializeFeaturedReviews } from "../src/lib/featured-reviews";
import { CAPI_EVENTS } from "../src/lib/meta-capi";

const read = (f: string) => readFileSync(f, "utf8");

test("anchor price: about 20% above the live price, clean ₹50 / x99 steps, follows any price", () => {
  for (const [price, was] of [[5499, 6599], [1999, 2399], [2499, 2999], [199, 249], [499, 599]] as const) assert.equal(anchorPrice(price)!.was, was, String(price));
  for (const p of [199, 299, 399, 599, 999, 2499, 3999, 5499, 8000, 12345]) {
    const a = anchorPrice(p)!;
    assert.ok(a.was > p * 1.1 && a.was < p * 1.3, `${p} -> ${a.was}`);
    assert.ok(a.was % 50 === 0 || a.was % 50 === 49, `${p} -> ${a.was} is a clean step`);
    assert.ok(a.pct >= 10 && a.pct <= 25);
  }
  assert.equal(anchorPrice(null), null);
  assert.equal(anchorPrice(0), null);
});

test("Window Cleaning is ₹299 per window; add-ons keep the owner prices", () => {
  const p = (id: string) => PRICING_MASTER.find((i) => i.contentId === id)!;
  assert.equal(p("SCS-30").price, 299);
  assert.deepEqual(["SCS-39", "SCS-32", "SCS-37", "SCS-38", "SCS-35", "SCS-09"].map((id) => p(id).price), [599, 399, 699, 299, 499, 199]);
});

test("SEO matrix: every pin-code locality the owner listed is present with its PIN", () => {
  const want: Record<string, string> = { baner: "411045", wakad: "411057", hinjewadi: "411057", kothrud: "411038", "viman-nagar": "411014", "koregaon-park": "411001", kharadi: "411014", hadapsar: "411028", magarpatta: "411028", aundh: "411007", bavdhan: "411021", "pimple-saudagar": "411027", pimpri: "411018", chinchwad: "411019", kondhwa: "411048", undri: "411060", nibm: "411048", "sinhagad-road": "411051", katraj: "411046", wagholi: "412207", ravet: "412101", punawale: "411033", balewadi: "411045", camp: "411001", deccan: "411004", "karve-nagar": "411052", warje: "411058", lohegaon: "411047", dhanori: "411015", yerwada: "411006", bibwewadi: "411037", swargate: "411042" };
  for (const [slug, pin] of Object.entries(want)) {
    const l = LOCALITIES.find((x) => x.slug === slug);
    assert.ok(l, `locality ${slug}`);
    assert.ok(l!.pins.includes(pin), `${slug} carries ${pin} (has ${l!.pins.join(",")})`);
  }
  for (const l of LOCALITIES) for (const n of l.near) assert.ok(LOCALITIES.some((x) => x.slug === n), `${l.slug} near ${n} exists`);
  assert.equal(PROGRAMMATIC_PAGES.length, LOCALITIES.length * SERVICE_CATEGORIES.length);
});

test("service FAQs cover duration, team size, water/electricity and stains; reviews keep a locality tag", () => {
  const f = commonServiceFaqs("Kitchen Deep Cleaning").map((x) => x.q.toLowerCase()).join(" | ");
  for (const k of ["how long", "how many people", "water and electricity", "stain"]) assert.ok(f.includes(k), k);
  const r = parseFeaturedReviews(serializeFeaturedReviews([{ name: "Priya S.", text: "Great", rating: 5, locality: "Baner" }]));
  assert.ok(r.ok && r.reviews[0]!.locality === "Baner");
});

test("tracking: standard funnel events exist, advance payment is opt-in, lead is captured on step 1", () => {
  for (const e of ["ViewContent", "InitiateCheckout", "Purchase", "Contact", "Lead"]) assert.ok((CAPI_EVENTS as readonly string[]).includes(e), e);
  const tags = read("src/components/public/marketing-tags.tsx");
  for (const f of ["trackViewContent", "trackInitiateCheckout", "trackPurchase"]) assert.match(tags, new RegExp(`export function ${f}`));
  assert.match(read("src/server/razorpay.ts"), /BOOKING_ADVANCE_ENABLED \?\? ""\)\.toLowerCase\(\) === "on"/);
  const flow = read("src/components/public/booking-flow.tsx");
  assert.match(flow, /const STEPS = \["Your details", "Package", "Address", "Date & time", "Confirm"\]/);
  assert.match(flow, /trackInitiateCheckout/);
  assert.match(read("src/server/actions/booking-checkout.ts"), /mobile not OTP-verified/);
});

test("UI: mobile cards collapse to 5 inclusions; sliders auto-slide every 2.2 s; boxed 1280px hero", () => {
  assert.match(read("src/components/public/collapsible-list.tsx"), /limit = 5/);
  assert.match(read("src/components/public/service-slider.tsx"), /const ROTATE_MS = 2200/);
  assert.match(read("src/components/public/home-hero-slider.tsx"), /md:max-w-\[1280px\]/);
  assert.match(read("src/config/service-slides.ts"), /slidesForCategory/);
});
