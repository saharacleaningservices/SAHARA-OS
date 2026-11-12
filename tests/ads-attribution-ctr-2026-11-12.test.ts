// PR #143 — Google Ads conversion wiring, 90-day attribution, CTR meta descriptions and the exact-scope block.
// Pure-function and source-level checks: no network, no database, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADS_CONVERSION_LABELS, GOOGLE_ADS_ID, __resetAdsConversionState, contactKindOfHref, fireAdsConversion } from "../src/lib/ads-conversions";
import { ATTRIBUTION_TTL_DAYS, cookieDomainFor, cookieValueFor, fbcFromFbclid, isTouchFresh, readCookie, touchFromCookieValue } from "../src/lib/attribution-storage";
import { sanitizeTouch, classifyTouch } from "../src/lib/attribution";
import { SOURCE_TAGS, sourceTagForChannel } from "../src/lib/source-tags";
import { ctrDescriptionFor, ctrDescriptions } from "../src/config/ctr-meta";
import { SCOPE_ROWS, scopeNotIncluded } from "../src/config/scope-checklist";
import { BRAND_TAGLINE } from "../src/lib/brand-tagline";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;

function withGtag(run: (calls: unknown[][]) => void) {
  const calls: unknown[][] = [];
  (globalThis as unknown as { window: unknown }).window = { gtag: (...a: unknown[]) => calls.push(a) };
  __resetAdsConversionState();
  try {
    run(calls);
  } finally {
    delete (globalThis as unknown as { window?: unknown }).window;
  }
}

// ── Part A: Google Ads conversions ───────────────────────────────────────────

test("conversion account and labels are the verified AW-765890204 values", () => {
  assert.equal(GOOGLE_ADS_ID, "AW-765890204");
  assert.deepEqual(ADS_CONVERSION_LABELS, { lead: "H8q6CI72raodEJydmu0C", whatsapp: "fixLCJH2raodEJydmu0C", call: "a0-rCJT2raodEJydmu0C" });
});

test("lead conversion sends exactly send_to + transaction_id, once per lead", () => {
  withGtag((calls) => {
    assert.equal(fireAdsConversion("lead", { transactionId: "LD-2026-0300" }), true);
    assert.deepEqual(calls[0], ["event", "conversion", { send_to: "AW-765890204/H8q6CI72raodEJydmu0C", transaction_id: "LD-2026-0300" }]);
    assert.equal(fireAdsConversion("lead", { transactionId: "LD-2026-0300" }), false, "same lead is never counted twice");
    assert.equal(fireAdsConversion("lead", { transactionId: "LD-2026-0301" }), true);
    assert.equal(calls.length, 2);
  });
});

test("whatsapp and call clicks send only send_to and are de-duplicated across listeners", () => {
  withGtag((calls) => {
    assert.equal(fireAdsConversion("whatsapp", { now: 1_000 }), true);
    assert.equal(fireAdsConversion("whatsapp", { now: 1_200 }), false, "second listener for the same tap");
    assert.equal(fireAdsConversion("whatsapp", { now: 5_000 }), true, "a later tap counts");
    assert.equal(fireAdsConversion("call", { now: 1_200 }), true, "call is independent of whatsapp");
    assert.deepEqual(calls[0], ["event", "conversion", { send_to: "AW-765890204/fixLCJH2raodEJydmu0C" }]);
    assert.deepEqual(calls.at(-1), ["event", "conversion", { send_to: "AW-765890204/a0-rCJT2raodEJydmu0C" }]);
  });
});

test("no gtag (tags not loaded, or server render) means no conversion and no crash", () => {
  delete (globalThis as unknown as { window?: unknown }).window;
  assert.equal(fireAdsConversion("lead", { transactionId: "x" }), false);
  (globalThis as unknown as { window: unknown }).window = {};
  assert.equal(fireAdsConversion("call"), false);
  delete (globalThis as unknown as { window?: unknown }).window;
});

test("contact links are classified as call / whatsapp only", () => {
  assert.equal(contactKindOfHref("tel:+917083347130"), "call");
  assert.equal(contactKindOfHref("https://wa.me/919175220270?text=Hi"), "whatsapp");
  assert.equal(contactKindOfHref("https://api.whatsapp.com/send?phone=91"), "whatsapp");
  assert.equal(contactKindOfHref("whatsapp://send?phone=91"), "whatsapp");
  assert.equal(contactKindOfHref("https://saharacleaningservices.com/whatsapp-offers"), null, "a path containing the word is not a chat link");
  assert.equal(contactKindOfHref("/booking"), null);
});

test("conversions fire on the action, never on page load", () => {
  const tags = read("src/components/public/marketing-tags.tsx");
  const calls = tags.match(/fireAdsConversion\(/g) ?? [];
  assert.equal(calls.length, 2, "exactly two call sites: trackLead (submit) and the click listener");
  assert.match(tags, /function trackLead[\s\S]*fireAdsConversion\("lead"/);
  assert.match(tags, /onClick[\s\S]*fireAdsConversion\(contact\)/);
  assert.ok(!/NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL/.test(tags.replace(/\/\/.*$/gm, "")), "old env label is no longer read");
  const tracker = read("src/components/public/seo-cta-tracker.tsx");
  assert.match(tracker, /fireAdsConversion\(contact\)/);
});

// ── Part A: 90-day attribution + Meta ids ────────────────────────────────────

test("a touch is usable for 90 days, then dropped", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  assert.equal(ATTRIBUTION_TTL_DAYS, 90);
  assert.equal(isTouchFresh({ at: new Date(now - 89 * DAY).toISOString() }, now), true);
  assert.equal(isTouchFresh({ at: new Date(now - 91 * DAY).toISOString() }, now), false);
  assert.equal(isTouchFresh({ at: null }, now), false);
  assert.equal(isTouchFresh({ at: "garbage" }, now), false);
  assert.equal(isTouchFresh({ at: new Date(now + 3 * DAY).toISOString() }, now), false, "clock-skewed future stamps are rejected");
});

test("cookie round trip keeps utm_*, gclid, fbclid, _fbp and _fbc", () => {
  const touch = { source: "google", medium: "cpc", campaign: "pune-deep", term: "deep cleaning pune", gclid: "Cj0KCQ_x", fbclid: "IwAR_abc123", fbp: "fb.1.1730000000000.123456789", fbc: "fb.1.1730000000000.IwAR_abc123", at: "2026-11-12T00:00:00.000Z", landingPageUrl: "https://saharacleaningservices.com/x?y=" + "z".repeat(900) };
  const header = `a=1; sahara_attr_first=${cookieValueFor(touch)}; b=2`;
  const back = touchFromCookieValue(readCookie(header, "sahara_attr_first"));
  assert.equal(back?.gclid, "Cj0KCQ_x");
  assert.equal(back?.term, "deep cleaning pune");
  assert.equal(back?.fbp, touch.fbp);
  assert.equal(back?.fbc, touch.fbc);
  assert.equal(back?.landingPageUrl, undefined, "long URL is dropped from the cookie copy to stay under the 4 KB limit");
  assert.ok(cookieValueFor(touch).length < 1500);
  assert.equal(readCookie("x=1", "sahara_attr_first"), null);
  assert.equal(touchFromCookieValue("{not json"), null);
});

test("cookie is shared across the apex and its subdomains only on the Sahara domain", () => {
  assert.equal(cookieDomainFor("saharacleaningservices.com"), ".saharacleaningservices.com");
  assert.equal(cookieDomainFor("booking.saharacleaningservices.com"), ".saharacleaningservices.com");
  assert.equal(cookieDomainFor("localhost"), null);
  assert.equal(cookieDomainFor("evilsaharacleaningservices.com"), null);
});

test("_fbc is rebuilt from fbclid in Meta's format; bad values are rejected", () => {
  assert.equal(fbcFromFbclid("IwAR_abc123", 1730000000000), "fb.1.1730000000000.IwAR_abc123");
  assert.equal(fbcFromFbclid("a b"), null);
  assert.equal(fbcFromFbclid(null), null);
});

test("server keeps only well-formed fbp / fbc from the browser", () => {
  const ok = sanitizeTouch({ fbp: "fb.1.1730000000000.123456789", fbc: "fb.1.1730000000000.IwAR_abc123" });
  assert.equal(ok?.fbp, "fb.1.1730000000000.123456789");
  assert.equal(ok?.fbc, "fb.1.1730000000000.IwAR_abc123");
  const bad = sanitizeTouch({ fbp: "<script>", fbc: "nope" });
  assert.equal(bad?.fbp, null);
  assert.equal(bad?.fbc, null);
});

test("capi route accepts validated fbp/fbc from the body and still falls back to cookies", () => {
  const route = read("src/app/api/meta/capi/route.ts");
  assert.match(route, /fbp: z\.string\(\)\.regex/);
  assert.match(route, /fbc: z\.string\(\)\.regex/);
  assert.match(route, /bodyFbp \?\? request\.cookies\.get\("_fbp"\)/);
  assert.match(route, /bodyFbc \?\? request\.cookies\.get\("_fbc"\)/);
});

// ── Part A: CRM source tags ──────────────────────────────────────────────────

test("paid channels map to the CRM source tags; everything else stays untagged", () => {
  assert.equal(sourceTagForChannel("Google Ads"), "SRC-GOOGLE-ADS");
  assert.equal(sourceTagForChannel("Meta Ads"), "SRC-META-ADS");
  for (const c of ["Google Organic/SEO", "Google Business Profile", "Facebook Organic", "Website Direct", "Unattributed", "Website Form", null, undefined]) assert.equal(sourceTagForChannel(c), null);
  assert.ok((SOURCE_TAGS as readonly string[]).includes("SRC-GOOGLE-ADS") && (SOURCE_TAGS as readonly string[]).includes("SRC-META-ADS"));
});

test("gclid / paid Meta touches classify into the channels that get tagged", () => {
  assert.equal(sourceTagForChannel(classifyTouch({ gclid: "abc", at: "x" })), "SRC-GOOGLE-ADS");
  assert.equal(sourceTagForChannel(classifyTouch({ source: "facebook", medium: "paid_social", at: "x" })), "SRC-META-ADS");
  assert.equal(sourceTagForChannel(classifyTouch({ fbclid: "abc", at: "x" })), null, "fbclid alone is not proof of a paid click");
});

test("all three lead-writing paths set the tag without overwriting a staff-chosen one", () => {
  for (const f of ["src/server/public-booking-core.ts", "src/server/actions/booking-checkout.ts", "src/server/enquiry-intake.ts"]) {
    assert.match(read(f), /sourceTagForChannel\(/, f);
  }
  assert.match(read("src/server/public-booking-core.ts"), /!existingOpen\.sourceTag && sourceTagForChannel/);
});

// ── Part B: CTR descriptions ─────────────────────────────────────────────────

test("meta descriptions use real catalog prices and the requested trust points", () => {
  const d = ctrDescriptions();
  assert.match(d["home-deep-cleaning"], /₹3,199/);
  assert.match(d["home-deep-cleaning"], /₹4,499/);
  assert.match(d["home-deep-cleaning"], /manual floor scrubbing/i);
  assert.ok(!/scrubbing machine/i.test(JSON.stringify(d)), "crew scrubs manually - no machine claim");
  assert.match(d["sofa-carpet-mattress-cleaning"], /₹199 per seat/);
  assert.match(d.home, /₹3,199/);
  const homepage = `${BRAND_TAGLINE} ${d.home}`; // the page prefixes the official tagline
  assert.match(read("src/app/page.tsx"), /const DESC = `\$\{BRAND_TAGLINE\} \$\{ctrDescriptions\(\)\.home\}`;/);
  for (const text of [d["home-deep-cleaning"], d["sofa-carpet-mattress-cleaning"], homepage]) {
    assert.match(text, /in-house trained staff/i);
    assert.match(text, /pay after service/i);
    assert.ok(text.length >= 110 && text.length <= 165, `snippet length ${text.length}: ${text}`);
  }
  assert.equal(ctrDescriptionFor("home-deep-cleaning"), d["home-deep-cleaning"]);
  assert.equal(ctrDescriptionFor("sofa-carpet-mattress-cleaning"), d["sofa-carpet-mattress-cleaning"]);
  assert.equal(ctrDescriptionFor("pest-control"), undefined, "other pages keep their own description");
});

test("only descriptions changed on the ranking pages: title, canonical and H1 lines are untouched", () => {
  const svc = read("src/app/(public)/services/[category]/page.tsx");
  assert.match(svc, /const title = `\$\{svc\.name\} in Pune \| \$\{svc\.pricing\.mode === "inspection" \? "Free Site Inspection" : "Fixed Rates"\} \| Sahara`;/);
  assert.match(svc, /const title = `\$\{c\.short\} in Pune — All Areas \| Sahara`;/);
  assert.match(svc, /alternates: \{ canonical: url \}/);
  assert.match(svc, /title=\{`\$\{s\.name\} in Pune`\}/, "hero (H1) text unchanged");
  const home = read("src/app/page.tsx");
  assert.match(home, /const TITLE = "Sahara Cleaning Services Pune — Home & Office Deep Cleaning, Pest Control, Painting";/);
  assert.match(home, /alternates: \{ canonical: `\$\{SITE_ORIGIN\}\/` \}/);
});

// ── Part B: exact-scope block ────────────────────────────────────────────────

test("scope block covers every requested item and never promises what the Scope of Work excludes", () => {
  const all = JSON.stringify(SCOPE_ROWS).toLowerCase();
  assert.ok(!/machine/i.test(all), "floors are scrubbed manually");
  for (const k of ["manual deep scrubbing", "specialized pads", "kitchen", "wardrobe", "balcony", "terrace", "tracks", "grills", "descaling", "furnished", "unfurnished"]) assert.ok(all.includes(k) || k.endsWith("furnished"), k);
  const furnishedWardrobe = SCOPE_ROWS.find((r) => r.area.startsWith("Wardrobes"))!;
  assert.match(furnishedWardrobe.furnished, /not touched/i, "furnished interiors are not promised");
  assert.match(furnishedWardrobe.unfurnished, /interiors cleaned/i);
  assert.ok(scopeNotIncluded().some((t) => /terrace/i.test(t)) && scopeNotIncluded().some((t) => /chimney/i.test(t)));
});

test("scope block renders only on /services/home-deep-cleaning and adds no H1", () => {
  const svc = read("src/app/(public)/services/[category]/page.tsx");
  assert.match(svc, /s\.slug === "home-deep-cleaning" && <ScopeChecklist \/>/);
  const comp = read("src/components/public/scope-checklist.tsx");
  assert.ok(!/<h1/i.test(comp));
  assert.match(comp, /<h2 id="exact-scope-h"/);
});
