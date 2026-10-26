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

test("/booking: ONE dark-blue footer (Visit us + phones → map → links/GSTIN/social once → Areas we serve last); no near-you block; sliders then FAQs", () => {
  const trust = read("src/components/public/landing-kit.tsx").split("export function BookingTrustGrid")[1] ?? "";
  assert.ok(!trust.includes("COMPANY.gstin") && !trust.includes("FooterSocial"), "trust grid no longer repeats GSTIN / social links");
  const page = read("src/app/booking/page.tsx");
  assert.ok(page.includes("footer={<BookingFooter />}"), "booking uses its own consolidated footer");
  assert.ok(!page.includes("Cleaning services near you") && !page.includes("SCHEMA_MICRO_LOCATIONS"), "mid-page near-you block and its area chips are gone");
  const f = read("src/components/public/booking-footer.tsx");
  const count = (needle: string) => f.split(needle).length - 1;
  assert.equal(count("<MapOnTap"), 1, "one interactive map");
  assert.equal(count("<FooterSocial"), 1, "social icons once");
  assert.equal(count("COMPANY.gstin"), 1, "GSTIN once");
  assert.ok(!f.includes("Serving Pune Since 2012"), "no repeat of the hero's Since 2012 block");
  assert.ok(f.indexOf("bf-visit") < f.indexOf("<MapOnTap") && f.indexOf("<MapOnTap") < f.indexOf("bf-services") && f.indexOf("bf-services") < f.indexOf("bf-areas"), "order: visit us, map, links, areas last");
  const iLogos = page.indexOf("<ClientLogosSlider />");
  const iReviews = page.indexOf("<ReviewsCarousel");
  const iFaqs = page.indexOf("<Faqs faqs={nearMeFaqs()}");
  assert.ok(iLogos > 0 && iReviews > iLogos && iFaqs > iReviews, "logos, then Google reviews, then the FAQs right above the footer");
});

test("client logos: empty list renders nothing (no invented clients); reviews come only from Settings → Featured Reviews", async () => {
  const { ClientLogosSlider } = await import("../src/components/public/client-logos-slider");
  assert.equal(ClientLogosSlider({ logos: [] }), null);
  assert.ok(read("src/components/public/client-logos-slider.tsx").includes("if (logos.length === 0) return null;"));
  assert.equal(read("src/lib/client-logos.ts").match(/CLIENT_LOGOS: ClientLogo\[\] = \[\]/)?.length, 1, "no clients are shipped until the owner adds real ones");
  assert.ok(read("src/app/booking/page.tsx").includes("settings.featuredReviews"));
});

test("call details: talk time and an http(s) recording link are read from common provider field names; anything else is ignored", async () => {
  const { callDetailsFrom, formatTalkTime } = await import("../src/lib/call-autoresponder");
  assert.deepEqual(callDetailsFrom({ DialCallDuration: "134", RecordingUrl: "https://rec.example.test/a/b.mp3" }), { durationSec: 134, recordingUrl: "https://rec.example.test/a/b.mp3" });
  assert.deepEqual(callDetailsFrom({ duration: 45, recording_url: "http://rec.example.test/x.wav" }), { durationSec: 45, recordingUrl: "http://rec.example.test/x.wav" });
  assert.deepEqual(callDetailsFrom({ duration: "0", recording: "javascript:alert(1)" }), { durationSec: null, recordingUrl: null });
  assert.equal(callDetailsFrom({ audio_url: "https://x.test/" + "a".repeat(600) }).recordingUrl, null, "over-long URLs are dropped");
  assert.deepEqual(callDetailsFrom({ caller: "9000000001" }), { durationSec: null, recordingUrl: null });
  assert.equal(formatTalkTime(134), "2m 14s");
  assert.equal(formatTalkTime(45), "45s");
});

test("call recordings: the call-trigger route passes them to the lead timeline, which plays CALL entries with audio", () => {
  assert.ok(read("src/app/api/v1/webhooks/call-trigger/route.ts").includes("recordCallLead(caller, event, callDetailsFrom(payload))"));
  assert.ok(read("src/server/call-lead.ts").includes("audioUrl: details.recordingUrl ?? null"));
  assert.ok(read("src/components/leads/conversation-timeline.tsx").includes('e.type === "CALL" && e.audioUrl'));
});

test("PDF headers: GSTIN/SAC above the badge, +91 numbers below; invoice is the light theme, quotation keeps its blue", () => {
  const inv = read("src/lib/pdf/sahara-invoice-document.tsx");
  assert.ok(inv.indexOf("<Text style={s.gst}>") < inv.indexOf("<Text style={s.badge}>") && inv.indexOf("ORIGINAL FOR RECIPIENT") < inv.indexOf("<Text style={s.mob}>"));
  const q = read("src/lib/pdf/sahara-bill-document.tsx");
  assert.ok(q.indexOf("<Text style={s.gstR}>") < q.indexOf("<Text style={s.titleBadge}>") && q.indexOf("<Text style={s.titleBadge}>") < q.indexOf("<Text style={s.phonesR}>"));
  assert.ok(q.includes("formatPhoneIN") && inv.includes("formatPhoneIN"));
  assert.ok(/const ROYAL = "#1E40AF"/.test(q));
});
