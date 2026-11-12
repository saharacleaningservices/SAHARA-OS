import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { __resetAdsConversionState, fireMetaContact } from "../src/lib/ads-conversions";
import { ADVANCE_PERCENT, advanceBreakdown, paymentSplit } from "../src/lib/booking-payment";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function withFbq(fn: (calls: unknown[][]) => void) {
  const calls: unknown[][] = [];
  const g = globalThis as unknown as { window?: unknown };
  const prev = g.window;
  g.window = { fbq: (...a: unknown[]) => calls.push(a) };
  __resetAdsConversionState();
  try { fn(calls); } finally { g.window = prev; }
}

test("Meta Contact: one event per tap even when two page listeners see it", () => {
  withFbq((calls) => {
    assert.equal(fireMetaContact("whatsapp", { method: "whatsapp" }, { now: 1_000 }), true);
    assert.equal(fireMetaContact("whatsapp", { content_name: "x" }, { now: 1_300 }), false, "second listener, same tap");
    assert.equal(fireMetaContact("call", { method: "call" }, { now: 1_300 }), true, "a different kind is a different tap");
    assert.equal(fireMetaContact("whatsapp", { method: "whatsapp" }, { now: 6_000 }), true, "a later tap counts");
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], ["track", "Contact", { method: "whatsapp" }]);
  });
});

test("Meta Contact: no Pixel, no event; trackers go through the shared guard", () => {
  __resetAdsConversionState();
  assert.equal(fireMetaContact("call", {}), false);
  const seo = read("src/components/public/seo-cta-tracker.tsx");
  const tags = read("src/components/public/marketing-tags.tsx");
  assert.doesNotMatch(seo, /fbq["']?\)?\s*\(?\s*["']track["'],\s*["']Contact/, "no direct Contact call in SeoCtaTracker");
  assert.doesNotMatch(tags, /\("track", "Contact"/, "no direct Contact call in MarketingTags");
  assert.match(seo, /fireMetaContact\(/);
  assert.match(tags, /fireMetaContact\(/);
  assert.match(tags, /__saharaSeoCtaTracker/, "shell tracker yields to the SEO tracker");
});

test("100% Pay After Service: no advance anywhere in the booking math or documents", () => {
  assert.equal(ADVANCE_PERCENT, 0);
  assert.deepEqual(paymentSplit(5000), { total: 5000, advance: 0, balance: 5000, percent: 0, balancePercent: 100 });
  assert.equal(advanceBreakdown(5000, "PAY_ADVANCE").advance, 0);
  assert.match(read("src/server/document-pdf.ts"), /paymentSplit: null/, "quotation PDF has no 20% advance block");
  assert.doesNotMatch(read("src/components/public/booking-wizard.tsx"), /\["PAY_ADVANCE", "Pay Advance"\]/, "wizard offers no advance choice");
  assert.doesNotMatch(read("src/components/public/booking-page-view.tsx"), />Pay Advance</, "booking page does not say Pay Advance");
});
