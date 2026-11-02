import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXTRA_AREAS, MOQ_VALUE, NO_MOQ_LOCALITIES, distanceKm, moqFor, suggestAddOns } from "../src/lib/zonal-moq";
import { cdnImageUrl } from "../src/lib/image-loader";
import { signBody, verifySignature } from "../src/lib/webhook-signature";
import { LOCALITIES } from "../src/config/pune-seo-matrix";

test("zonal MOQ: Zone A (16 East / central areas) free; Zone B (West, Kothrud–Warje–Sinhagad–Narhe, PCMC) ₹3,999; others free", () => {
  assert.equal(MOQ_VALUE, 3999);
  const WEST = LOCALITIES.filter((l) => l.zone === "west-pcmc").map((l) => l.slug);
  for (const s of ["magarpatta", "hadapsar", "kharadi", "undri", "nibm", "wanowrie", "mohammadwadi", "phursungi", "handewadi", "viman-nagar", "camp", "kalyani-nagar", "koregaon-park", "kondhwa", "dhankawadi", "balaji-nagar"]) assert.equal(moqFor({ locality: s }, WEST).moq, 0, s);
  for (const s of ["hinjewadi", "baner", "wakad", "pashan", "aundh", "bavdhan", "kothrud", "warje", "sinhagad-road", "narhe", "pimpri", "chinchwad", "nigdi", "bhosari"]) assert.equal(moqFor({ locality: s }, WEST).moq, 3999, s);
  for (const s of ["yerwada", "katraj", "shivajinagar", "manjri", "other"]) assert.equal(moqFor({ locality: s }, WEST).moq, 0, `${s} is not a restricted area`);
  for (const s of NO_MOQ_LOCALITIES) assert.ok(LOCALITIES.some((l) => l.slug === s) || EXTRA_AREAS.some((x) => x.slug === s), `${s} is selectable in the area picker`);
});

test("zonal MOQ: a GPS fix near a branch waives it; a Zone B area always keeps it", () => {
  assert.equal(moqFor({ gps: { lat: 18.515, lng: 73.935 }, locality: "other" }).moq, 0);
  assert.equal(moqFor({ gps: { lat: 18.515, lng: 73.935 }, locality: "hinjewadi" }).moq, 3999);
  assert.ok(distanceKm({ lat: 18.5082, lng: 73.9298 }, { lat: 18.591, lng: 73.738 }) > 15);
});

test("pest control is excluded from the minimum order (final sprint: every other priced basket is gated)", () => {
  const m = readFileSync("src/components/public/quick-booking-modal.tsx", "utf8");
  assert.match(m, /const moqApplies = priced && intent\.category !== "PEST_CONTROL";/);
});

test("add-on suggestions close the gap first, skip items already in the basket", () => {
  const pool = [
    { contentId: "A", name: "Window", price: 300, minQty: 1 },
    { contentId: "B", name: "Bathroom", price: 599, minQty: 2 },
    { contentId: "C", name: "Kitchen+3Bath", price: 3999, minQty: 1 },
    { contentId: "D", name: "Living+Balcony", price: 1899, minQty: 1 },
  ];
  const s = suggestAddOns(1500, pool, ["A"]);
  assert.equal(s[0].contentId, "D", "cheapest single add-on that closes the gap");
  assert.ok(!s.some((x) => x.contentId === "A"));
  assert.deepEqual(suggestAddOns(0, pool), []);
});

test("CDN loader: off unless configured; ImageKit and Cloudinary URLs carry width, quality and auto format", () => {
  assert.equal(cdnImageUrl({ src: "/marketing/a.webp", width: 640 }, {}), "/marketing/a.webp");
  assert.equal(cdnImageUrl({ src: "/marketing/a.webp", width: 640, quality: 70 }, { kind: "imagekit", base: "https://ik.imagekit.io/sahara" }), "https://ik.imagekit.io/sahara/marketing/a.webp?tr=w-640,q-70,f-auto");
  const c = cdnImageUrl({ src: "/marketing/a.webp", width: 1080 }, { kind: "cloudinary", base: "https://res.cloudinary.com/x/image/fetch" });
  assert.match(c, /^https:\/\/res\.cloudinary\.com\/x\/image\/fetch\/f_auto,q_75,w_1080,c_limit\/https%3A%2F%2Fsaharacleaningservices\.com%2Fmarketing%2Fa\.webp$/);
  const cfg = readFileSync("next.config.ts", "utf8");
  assert.match(cfg, /loaderFile: "\.\/src\/lib\/image-loader\.ts"/);
});

test("CRM webhook: HMAC signature required; JOB_COMPLETED queues the review after the delay", async () => {
  const body = JSON.stringify({ event: "JOB_COMPLETED", jobNumber: "JOB-2026-0001" });
  const secret = "test-secret-1234567890";
  assert.ok(verifySignature(body, signBody(body, secret), secret));
  assert.ok(!verifySignature(body, signBody(body, "other-secret-123456"), secret));
  assert.ok(!verifySignature(body, null, secret));
  const route = readFileSync("src/app/api/webhooks/crm/route.ts", "utf8");
  assert.match(route, /CRM_WEBHOOK_SECRET/);
  assert.match(route, /enqueueReviewRequest\(job\.id\)/);
  const { reviewDelayMs } = await import("../src/server/job-queue-handlers");
  assert.equal(reviewDelayMs({}), 120 * 60_000);
  assert.equal(reviewDelayMs({ REVIEW_DELAY_MINUTES: "30" }), 30 * 60_000);
  for (const f of ["src/server/actions/jobs.ts", "src/server/actions/payments.ts"]) assert.doesNotMatch(readFileSync(f, "utf8"), /sendReviewIfDue\(/, `${f} queues reviews instead of sending immediately`);
});

test("order tracker: Job ID + mobile → hashed 4-digit OTP, generic answer, single use, limited tries", () => {
  const t = readFileSync("src/server/order-track.ts", "utf8");
  for (const f of ["OTP_LENGTH = 4", "randomInt(0, 10 ** OTP_LENGTH)", "timingSafeEqual", "MAX_TRIES = 5", "TTL_MS = 10 * 60_000", "consumedAt: new Date()", "rateLimit(`track:ip:", "GENERIC"]) assert.ok(t.includes(f), f);
  assert.doesNotMatch(t, /codePlain:/, "the code is never stored in plain text");
  assert.match(readFileSync("src/middleware.ts", "utf8"), /"\/track"/);
});

test("booking modal: locality picker, zonal MOQ with 1-tap add-ons, B2B site-audit fields", () => {
  const m = readFileSync("src/components/public/quick-booking-modal.tsx", "utf8");
  for (const f of ["moqFor({ locality, pincode: pin.length === 6 ? pin : \"\", gps }, WEST_PCMC)", "upgradeBundle(", "getQuickAddOns()", 'name="locality"', 'name="company"', 'name="propType"', 'name="sqft"', "Free Site Audit Request", "disabled={state === \"sending\" || gap > 0}"]) assert.ok(m.includes(f), f);
  // Field order: Name → Mobile → Full address (area + mandatory flat/society/landmark, GPS optional) → date → slot.
  const order = ['name="name"', 'name="mobile"', 'name="locality"', 'name="area"', "<MonthCalendar", 'aria-label="Time slot"'].map((x) => m.indexOf(x));
  assert.deepEqual([...order].sort((x, y) => x - y), order, "form fields in the owner's order");
  assert.match(m, /name="area" autoComplete="street-address" required/);
  assert.match(m, /Use current location \(optional\)/);
  assert.match(m, /getDateAvailability\(30\)/, "30-day calendar");
  assert.match(m, /"Your Booking Has Been Confirmed!"/);
  assert.doesNotMatch(m, /Your slot is reserved/);
});

test("before/after slider: pointer drag + keyboard, clip-path (no layout shift)", () => {
  const s = readFileSync("src/components/public/before-after-slider.tsx", "utf8");
  for (const f of ["onPointerDown", "setPointerCapture", 'role="slider"', "ArrowLeft", "clipPath"]) assert.ok(s.includes(f), f);
  assert.match(readFileSync("src/components/public/before-after-gallery.tsx", "utf8"), /<BeforeAfterSlider/);
});

test("image registry: every path exists, the seven core services are distinct, nothing text-baked is used", async () => {
  const { existsSync } = await import("node:fs");
  const { IMAGE_REGISTRY, CORE_SERVICE_IMAGE_KEYS, TEXT_BAKED_PATTERNS } = await import("../src/config/image-registry");
  for (const [k, v] of Object.entries(IMAGE_REGISTRY)) {
    assert.ok(existsSync(`public${v.src}`), `${k}: ${v.src} missing`);
    assert.ok(!TEXT_BAKED_PATTERNS.some((re) => re.test(v.src)), `${k} uses a text-baked graphic`);
  }
  const core = CORE_SERVICE_IMAGE_KEYS.map((k) => IMAGE_REGISTRY[k].src);
  assert.equal(new Set(core).size, core.length, "core services share an image");
  const { CATALOG_SERVICES } = await import("../src/config/service-catalog");
  for (const s of CATALOG_SERVICES) assert.ok(!TEXT_BAKED_PATTERNS.some((re) => re.test(s.image)), `${s.slug} uses a text-baked graphic`);
  const home = readFileSync("src/components/public/home-page.tsx", "utf8");
  assert.match(home, /img\("hero-home"\)/, "hero slides come from the registry");
});
