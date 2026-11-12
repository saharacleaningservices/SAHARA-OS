import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appendRefToWhatsAppUrl, parseRefCode, refCodeForTouch, slugFromPath, sourceLabelForTag, sourceTagForRef, stripRefCode, withSourceHeader } from "../src/lib/source-label";
import { campaignNumber, sourceTagForChannel } from "../src/lib/source-tags";
import { adminWhatsAppBody } from "../src/server/notify";
import { alreadyRelayed, __resetRelayed, leadEventId, LEAD_EVENT_ID_TTL_MS } from "../src/lib/meta-event-id";
import { buildCapiPayload } from "../src/lib/meta-capi";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("campaign tags cover G1-G7 and M1-M7 (G6/M6 painting, G7/M7 pest control)", () => {
  assert.equal(sourceTagForChannel("Google Ads", "g6_painting"), "SRC-GOOGLE-G6");
  assert.equal(sourceTagForChannel("Google Ads", "pest-g7"), "SRC-GOOGLE-G7");
  assert.equal(sourceTagForChannel("Meta Ads", "M6"), "SRC-META-M6");
  assert.equal(sourceTagForChannel("Meta Ads", "m7_pest"), "SRC-META-M7");
  assert.equal(campaignNumber("g8", "g"), null);
  assert.equal(sourceTagForChannel("Google Ads", "brand"), "SRC-GOOGLE-ADS");
});

test("GMB branch tag comes from utm_campaign or the live links' utm_medium; SEO needs an organic-search visit", () => {
  assert.equal(sourceTagForChannel("Google Business Profile", "magarpatta"), "SRC-GMB-MAGARPATTA");
  assert.equal(sourceTagForChannel("Google Business Profile", "mohammadwadi"), "SRC-GMB-MOHAMMADWADI");
  assert.equal(sourceTagForChannel("Google Business Profile", "gmb_book_online", "mohammadwadi_branch"), "SRC-GMB-MOHAMMADWADI");
  assert.equal(sourceTagForChannel("Google Business Profile", "gmb_book_online", "magarpatta_branch"), "SRC-GMB-MAGARPATTA");
  assert.equal(sourceTagForChannel("Google Business Profile", "gmb_book_online"), null, "no branch named - never guessed");
  assert.equal(sourceTagForChannel("Google Organic/SEO", null), "SRC-ORGANIC-SEO");
  assert.equal(sourceTagForChannel("WhatsApp Direct", null), null);
});

test("ref codes for the website buttons", () => {
  const t = (o: object) => ({ at: new Date().toISOString(), ...o });
  assert.equal(refCodeForTouch(t({ source: "gmb", medium: "magarpatta_branch", campaign: "gmb_book_online" })), "GMB-MAGARPATTA");
  assert.equal(refCodeForTouch(t({ source: "gmb", campaign: "mohammadwadi" })), "GMB-MOHDWADI");
  assert.equal(refCodeForTouch(t({ source: "google", medium: "cpc", campaign: "g1_home_deep", gclid: "x" })), "GOOGLE-G1");
  assert.equal(refCodeForTouch(t({ gclid: "abc", campaign: "brand" })), "GOOGLE-ADS");
  assert.equal(refCodeForTouch(t({ source: "meta_ads", campaign: "m1_sofa" })), "META-M1");
  assert.equal(refCodeForTouch(t({ referrer: "https://www.google.com/", landingPage: "/services/home-deep-cleaning" })), "SEO-HOME-DEEP-CLEANING");
  assert.equal(refCodeForTouch(t({})), null, "direct visitor gets no tag");
  assert.equal(refCodeForTouch(null), null);
  assert.equal(slugFromPath("/services/home-deep-cleaning/magarpatta?x=1"), "HOME-DEEP-CLEANING-MAGARPATTA");
  assert.equal(slugFromPath("/"), "WEB");
});

test("[Ref: …] parse / strip / tag round trip", () => {
  const msg = "Hi Sahara, I'd like a quote.\n[Ref: GMB-MOHDWADI]";
  assert.equal(parseRefCode(msg), "GMB-MOHDWADI");
  assert.equal(stripRefCode(msg), "Hi Sahara, I'd like a quote.");
  assert.equal(parseRefCode("[ref:google-g3]"), "GOOGLE-G3");
  assert.equal(parseRefCode("no tag here"), null);
  assert.equal(sourceTagForRef("GMB-MAGARPATTA"), "SRC-GMB-MAGARPATTA");
  assert.equal(sourceTagForRef("GMB-MOHDWADI"), "SRC-GMB-MOHAMMADWADI");
  assert.equal(sourceTagForRef("GOOGLE-G7"), "SRC-GOOGLE-G7");
  assert.equal(sourceTagForRef("META-M2"), "SRC-META-M2");
  assert.equal(sourceTagForRef("SEO-SOFA-CLEANING"), "SRC-ORGANIC-SEO");
  assert.equal(sourceTagForRef("GOOGLE-G9"), null);
  assert.equal(sourceTagForRef("RANDOM-CODE"), null, "a code Sahara does not issue is ignored");
});

test("WhatsApp links get the tag once, on their own line; other links are left alone", () => {
  const base = "https://wa.me/919175220270?text=Hi%20Sahara%2C%20I%27d%20like%20a%20quote.";
  const out = appendRefToWhatsAppUrl(base, "GOOGLE-G1")!;
  assert.equal(new URL(out).searchParams.get("text"), "Hi Sahara, I'd like a quote.\n[Ref: GOOGLE-G1]");
  assert.equal(appendRefToWhatsAppUrl(out, "META-M1"), null, "already tagged");
  assert.equal(new URL(appendRefToWhatsAppUrl("https://wa.me/919175220270", "SEO-WEB")!).searchParams.get("text"), "[Ref: SEO-WEB]");
  assert.ok(appendRefToWhatsAppUrl("https://api.whatsapp.com/send?phone=919175220270&text=Hi", "GOOGLE-G2"));
  assert.equal(appendRefToWhatsAppUrl("https://chat.whatsapp.com/abc123", "GOOGLE-G1"), null);
  assert.equal(appendRefToWhatsAppUrl("https://example.com/?text=hi", "GOOGLE-G1"), null);
  assert.equal(appendRefToWhatsAppUrl("tel:+917083347130", "GOOGLE-G1"), null);
});

test("CRM labels and the admin WhatsApp header", () => {
  assert.deepEqual(sourceLabelForTag("SRC-GMB-MAGARPATTA"), { label: "GMB - Magarpatta", header: "[GMB-MAGARPATTA]" });
  assert.deepEqual(sourceLabelForTag("SRC-GMB-MOHAMMADWADI"), { label: "GMB - Mohammadwadi", header: "[GMB-MOHDWADI]" });
  assert.deepEqual(sourceLabelForTag("SRC-GOOGLE-G1"), { label: "Google Ads (G1)", header: "[GOOGLE-ADS-G1]" });
  assert.deepEqual(sourceLabelForTag("SRC-META-M1"), { label: "Meta Ads (M1)", header: "[META-ADS-M1]" });
  assert.deepEqual(sourceLabelForTag("SRC-ORGANIC-SEO", "/services/sofa-carpet-mattress-cleaning"), { label: "SEO Landing Page (Sofa Carpet Mattress Cleaning)", header: "[SEO-WEB]" });
  assert.equal(sourceLabelForTag(null).label, "Direct / Repeat Customer");
  assert.equal(sourceLabelForTag("SRC-DIRECT-WA").label, "Direct / Repeat Customer");
  assert.equal(withSourceHeader("New enquiry", sourceLabelForTag("SRC-META-M1")), "[META-ADS-M1]\nNew enquiry\n🏷️ Source: Meta Ads (M1)");
});

test("only new enquiry / booking alerts get the source header", () => {
  const enquiry = adminWhatsAppBody({ kind: "NEW_INQUIRY", title: "New enquiry — Asha", body: "LD-1 · sofa", sourceTag: "SRC-GOOGLE-G1" });
  assert.equal(enquiry.split("\n")[0], "[GOOGLE-ADS-G1]");
  assert.ok(enquiry.includes("🏷️ Source: Google Ads (G1)"));
  assert.equal(adminWhatsAppBody({ kind: "NEW_BOOKING", title: "New booking", sourceTag: null }).split("\n")[0], "[DIRECT]");
  assert.equal(adminWhatsAppBody({ kind: "PAYMENT_RECEIVED", title: "Payment ₹5,000", body: "LD-1" }), "Payment ₹5,000\nLD-1");
});

test("staff sign-ins never WhatsApp the owner", () => {
  const login = read("src/server/login-session.ts");
  assert.match(login, /whatsappToAdmin: false/);
  assert.ok(read("src/server/notify.ts").includes("export const whatsappCopyFor = (kind: NotifKind, whatsappToAdmin?: boolean) => !SECURITY_KINDS.has(kind)"));
  const route = read("src/app/api/auth/login/route.ts");
  assert.match(route, /process\.env\.DEVICE_APPROVAL_WHATSAPP === "on"/, "device-approval WhatsApp is opt-in");
  assert.ok(route.indexOf('DEVICE_APPROVAL_WHATSAPP') < route.indexOf('kind: "DEVICE_APPROVAL"'));
});

test("webhook parses [Ref:] before keyword matching and tags new leads", () => {
  const wh = read("src/app/api/webhooks/whatsapp/route.ts");
  assert.match(wh, /const refCode = parseRefCode\(rawBody\);\s+const body = stripRefCode\(rawBody\);/);
  assert.equal((wh.match(/refCode \}\);/g) ?? []).length, 2, "both inquiry entry points pass the ref code");
  assert.match(wh, /sourceTag: leadSourceTag/);
});

test("Meta: one event_id per customer reaches Pixel and CAPI, and a replay is relayed once", () => {
  const store = new Map<string, string>();
  const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  let n = 0;
  const mint = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const t0 = 1_700_000_000_000;
  const a = leadEventId("98765 43210", s, t0, mint);
  assert.equal(leadEventId("+91 9876543210", s, t0 + 60_000, mint), a, "same customer, same session: same id (step-1 capture then final submit)");
  assert.notEqual(leadEventId("9123456780", s, t0, mint), a, "different customer: new id");
  assert.notEqual(leadEventId("9876543210", s, t0 + LEAD_EVENT_ID_TTL_MS + 1, mint), a, "after 30 minutes: new id");
  assert.match(leadEventId(undefined, s, t0), /^[0-9a-f-]{36}$/i, "no mobile: still a UUID");
  const payload = buildCapiPayload({ eventName: "Lead", eventId: a, sourceUrl: "https://saharacleaningservices.com/", mobile: "9876543210", now: t0 });
  assert.equal(payload.data[0]!.event_id, a, "CAPI event_id is the Pixel eventID");
  __resetRelayed();
  assert.equal(alreadyRelayed("Lead", a, t0), false);
  assert.equal(alreadyRelayed("Lead", a, t0 + 1000), true, "retry / double submit not sent twice");
  assert.equal(alreadyRelayed("Purchase", a, t0 + 1000), false, "different event name is a different event");
  const tags = read("src/components/public/marketing-tags.tsx");
  assert.match(tags, /const eventId = leadEventId\(details\.mobile, sessionStore\(\)\);/);
  assert.match(tags, /\{ eventID: eventId \}\);\s+sendServerEvent\("Lead", eventId, details\);/);
});
