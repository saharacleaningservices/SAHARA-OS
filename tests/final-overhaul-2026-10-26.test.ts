// Owner master task 2026-10-26: compact crew card, review funnel path route, /booking footer cleanup + sliders. Run: npm run test:overhaul
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(f, "utf8");

test("crew group message: plain-text location, the job-card token URL is the only link (no Google Maps preview box)", async () => {
  const { crewGroupMessage } = await import("../src/server/crew-card");
  const text = crewGroupMessage(
    { jobNumber: "JOB-2026-0001", service: "Home Deep Cleaning", packageLabel: "2 BHK — Platinum", date: new Date("2026-11-02T00:00:00Z"), timeSlot: "10:00 AM", area: "Kharadi", address: "Flat 2", mapLink: "https://maps.google.com/?q=18.55,73.94", team: "Team 2", crew: ["Ravi (lead)", "Asha"], supervisor: "Imran" },
    "https://crm.example.test/crew-card/tok.sig",
  );
  assert.ok(text.includes("📍 Kharadi"));
  assert.deepEqual(text.match(/https?:\/\/\S+/g), ["https://crm.example.test/crew-card/tok.sig"]);
  assert.ok(!/maps\.google|google\.com/.test(text));
  assert.ok(text.split("\n").length <= 8, "compact");
});

test("review funnel: /review/{token} serves the same funnel (booking token or 10-char short code); v3 button targets the funnel", () => {
  const route = read("src/app/review/[token]/page.tsx");
  assert.ok(route.includes('ReviewPage({ searchParams: Promise.resolve(value.length === 10 ? { c: value } : { t: value }) })'));
  const tpl = read("src/lib/whatsapp-cloud-templates.ts");
  assert.ok(/sahara_job_completed_v3[\s\S]{0,900}Rate Us on Google", url: `\$\{PUBLIC_BOOKING_URL\}\/review\?t=\{\{1\}\}`/.test(tpl), "v3 Rate Us button opens the internal funnel");
  assert.ok(read("src/server/job-queue-handlers.ts").includes("/review?c=${code}"), "plain-text completion links the funnel too");
});

test("/booking: GSTIN and social links appear once (footer), one map, areas once, sliders sit above the FAQs", () => {
  const trust = read("src/components/public/landing-kit.tsx").split("export function BookingTrustGrid")[1] ?? "";
  assert.ok(!trust.includes("COMPANY.gstin") && !trust.includes("FooterSocial"), "trust grid no longer repeats GSTIN / social links");
  const page = read("src/app/booking/page.tsx");
  assert.ok(page.includes("singleMap"), "booking footer shows one map");
  assert.ok(!page.includes("SCHEMA_MICRO_LOCATIONS"), "no second areas list in the page body");
  const iLogos = page.indexOf("<ClientLogosSlider />");
  const iReviews = page.indexOf("<ReviewsCarousel");
  const iFaqs = page.indexOf("<Faqs faqs={nearMeFaqs()}");
  assert.ok(iLogos > 0 && iReviews > iLogos && iFaqs > iReviews, "logos, then Google reviews, then FAQs");
});

test("client logos: empty list renders nothing (no invented clients); reviews come only from Settings → Featured Reviews", async () => {
  const { ClientLogosSlider } = await import("../src/components/public/client-logos-slider");
  assert.equal(ClientLogosSlider({ logos: [] }), null);
  assert.ok(read("src/components/public/client-logos-slider.tsx").includes("if (logos.length === 0) return null;"));
  assert.equal(read("src/lib/client-logos.ts").match(/CLIENT_LOGOS: ClientLogo\[\] = \[\]/)?.length, 1, "no clients are shipped until the owner adds real ones");
  assert.ok(read("src/app/booking/page.tsx").includes("settings.featuredReviews"));
});
