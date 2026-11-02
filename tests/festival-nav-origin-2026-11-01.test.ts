import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FESTIVALS, activeFestival, countdownTo } from "../src/lib/festival-calendar";
import { NAV_MEGA, NAV_HREFS, isKnownNavHref } from "../src/config/nav-menu";
import { leadOrigin, branchFromSignals, originSnapshot, originLineOf } from "../src/lib/lead-origin";
import { BRANCHES, SERVICE_CATEGORIES } from "../src/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "../src/lib/seo-graph";

const at = (ymd: string) => Date.parse(`${ymd}T10:00:00+05:30`);

test("festival engine: date-based, one festival at a time, none out of season", () => {
  assert.equal(activeFestival(at("2026-11-01"))?.kind, "diwali");
  assert.equal(activeFestival(at("2026-11-01"))?.upcoming, true);
  assert.equal(activeFestival(at("2026-09-12"))?.kind, "ganpati");
  assert.equal(activeFestival(at("2026-12-24"))?.kind, "christmas-newyear");
  assert.equal(activeFestival(at("2027-03-08"))?.kind, "eid");
  assert.equal(activeFestival(at("2026-11-20")), null, "after the Diwali window nothing shows");
  assert.equal(activeFestival(at("2026-07-01")), null);
  for (const f of FESTIVALS) assert.match(f.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("festival countdown ticks to the festival day (IST midnight)", () => {
  const f = activeFestival(at("2026-11-01"))!;
  const c = countdownTo(f.targetMs, Date.parse("2026-11-07T00:00:00+05:30"));
  assert.deepEqual([c.days, c.hours, c.done], [1, 0, false]);
  assert.equal(countdownTo(f.targetMs, f.targetMs + 1000).done, true);
});

test("festival components: reduced-motion safe, no layout shift, no prices or slot counts", () => {
  const fx = readFileSync("src/components/ui/festival-effects.tsx", "utf8");
  assert.match(fx, /prefers-reduced-motion/);
  assert.match(fx, /pointer-events-none/);
  assert.match(fx, /IntersectionObserver/);
  const ann = readFileSync("src/components/public/festival-announcement.tsx", "utf8");
  assert.match(ann, /fixed inset-x-0/);
  assert.match(ann, /backdrop-blur/);
  assert.doesNotMatch(ann, /₹|% off|slots left|only \d/i);
  // 2026-11-01 (final): standard mega-menu header, no festival banner or effects in the public shell.
  const kit = readFileSync("src/components/public/landing-kit.tsx", "utf8");
  assert.doesNotMatch(kit, /FestivalAnnouncement|FestivalZoneEffects/);
  assert.match(kit, /<MegaMenuHeader/);
  assert.doesNotMatch(readFileSync("src/components/public/mega-menu.tsx", "utf8"), /<details key=/, "no nested accordions in the mobile menu");
});

test("mega-menu: 4 categories (Residential, Individual, Commercial B2B, Relocation & Property), every link on an existing route", () => {
  assert.deepEqual(NAV_MEGA.map((m) => m.id), ["residential", "individual", "commercial", "relocation"]);
  assert.deepEqual(NAV_MEGA.map((m) => m.label), ["Residential Services", "Individual Services", "Commercial Services (B2B)", "Relocation & Property Services"]);
  for (const m of NAV_MEGA) assert.ok(m.items.length >= 3, `${m.id} has services`);
  for (const h of NAV_HREFS) assert.ok(isKnownNavHref(h), `unknown menu link ${h}`);
  // Commercial and relocation are always on inspection; no fixed price is ever shown for them.
  for (const m of NAV_MEGA.filter((x) => x.id === "commercial" || x.id === "relocation")) for (const i of m.items) assert.equal(i.pricing, "inspection", i.label);
  assert.ok(SERVICE_CATEGORIES.length >= 6);
  assert.doesNotMatch(JSON.stringify(NAV_MEGA), /waterproof|wallpaper/i);
});

test("lead origin labels: GMB per branch, Google Ads, Meta Ads, Direct Web", () => {
  assert.equal(leadOrigin({ source: "WEBSITE", utmSource: "gmb", utmMedium: "magarpatta_branch", utmCampaign: "gmb_book_online" }), "GMB Magarpatta");
  assert.equal(leadOrigin({ source: "WEBSITE", utmSource: "gmb", utmMedium: "mohammadwadi_branch", utmCampaign: "gmb_book_online" }), "GMB Mohammadwadi");
  assert.equal(leadOrigin({ source: "WEBSITE", gclid: "abc" }), "Google Ads");
  assert.equal(leadOrigin({ source: "WEBSITE", utmSource: "meta_ads" }), "Meta Ads");
  assert.equal(leadOrigin({ source: "WEBSITE" }), "Direct Web");
  assert.equal(branchFromSignals({ sourceLine: "Shoyab-GMB" }), "Mohammadwadi");
  assert.deepEqual(originSnapshot({ source: "WEBSITE", utmSource: "gmb", utmMedium: "mohammadwadi_branch" }), { leadSource: "GMB Mohammadwadi", branchTag: "Mohammadwadi" });
  assert.equal(originLineOf("Google Ads", "Magarpatta"), "Google Ads · Magarpatta branch");
  assert.equal(originLineOf(null, null), null);
});

test("lead source + branch carried into Quotation and Invoice (schema, creation points, PDF headers)", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.equal((schema.match(/leadSource\s+String\?/g) ?? []).length, 2);
  assert.equal((schema.match(/branchTag\s+String\?/g) ?? []).length, 2);
  assert.match(readFileSync("scripts/db-setup.mjs", "utf8"), /ADD COLUMN "leadSource"/);
  assert.match(readFileSync("src/server/actions/leads.ts", "utf8"), /originSnapshot\(lead\)/);
  assert.match(readFileSync("src/server/actions/quotations.ts", "utf8"), /leadSource: quotation\.leadSource/);
  assert.match(readFileSync("src/server/actions/jobs.ts", "utf8"), /leadSource: origin\.leadSource/);
  assert.match(readFileSync("src/server/document-pdf.ts", "utf8"), /Lead Source/);
  assert.match(readFileSync("src/lib/pdf/sahara-invoice-document.tsx", "utf8"), /Lead Source/);
});

test("GMB Book online: ReserveAction with the fixed UTM links; Mohammadwadi carries both numbers", () => {
  assert.equal(BRANCHES.magarpatta.bookOnlineUrl, "https://saharacleaningservices.com?utm_source=gmb&utm_medium=magarpatta_branch&utm_campaign=gmb_book_online");
  assert.equal(BRANCHES.mohammadwadi.bookOnlineUrl, "https://saharacleaningservices.com?utm_source=gmb&utm_medium=mohammadwadi_branch&utm_campaign=gmb_book_online");
  const moh = branchGraph().find((n) => (n as { branchCode?: string }).branchCode === "MOHAMMADWADI") as Record<string, unknown>;
  assert.deepEqual(moh.telephone, ["+918956567130", "+917083347130"]);
  const acts = moh.potentialAction as { "@type": string; target: { urlTemplate: string } }[];
  assert.ok(acts.some((a) => a["@type"] === "ReserveAction" && a.target.urlTemplate === BRANCHES.mohammadwadi.bookOnlineUrl));
  const mag = magarpattaBranchExtra();
  assert.ok((mag.potentialAction as { "@type": string; target?: { urlTemplate: string } }[]).some((a) => a["@type"] === "ReserveAction" && a.target?.urlTemplate === BRANCHES.magarpatta.bookOnlineUrl));
});

test("booking form (UI rollback 2026-11-01): original flow only, no verbal-rate / agreed-rate mode", () => {
  const w = readFileSync("src/components/public/booking-wizard.tsx", "utf8");
  assert.doesNotMatch(w, /Agreed Rate on Verbal Call|Standard Package Rate|rateMode/);
  assert.match(w, /Tap a service above to see its packages and book/);
});

test("contact page: native form to /api/leads/submit, no Cognito iframe, branch cards with directions", () => {
  const page = readFileSync("src/app/contact/page.tsx", "utf8") + readFileSync("src/components/public/contact-form.tsx", "utf8") + readFileSync("src/components/public/branch-cards.tsx", "utf8");
  assert.doesNotMatch(page, /<iframe|cognitoforms/i);
  assert.match(page, /\/api\/leads\/submit/);
  assert.match(page, /maps\/dir/);
  assert.match(page, /411028|postalCode/);
  const api = readFileSync("src/app/api/leads/submit/route.ts", "utf8");
  assert.match(api, /ingestEnquiry/);
  assert.match(api, /rateLimit/);
  assert.match(readFileSync("src/middleware.ts", "utf8"), /"\/api\/leads\/submit"/);
});

test("client carousel + About: no broken images, single marquee, honest years", () => {
  const c = readFileSync("src/components/ui/client-carousel.tsx", "utf8");
  assert.match(c, /onError/);
  assert.match(c, /motion-reduce/);
  assert.match(readFileSync("src/components/public/client-logos-slider.tsx", "utf8"), /ClientCarousel/);
  const a = readFileSync("src/components/public/home-about.tsx", "utf8");
  assert.match(a, /lg:grid-cols-2/);
  assert.match(a, /Same-Day Slots/);
  assert.match(a, /GST Billing/);
  assert.doesNotMatch(a, /25\+/);
});
