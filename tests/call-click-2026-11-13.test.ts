// Website tap-to-call tracking (owner 2026-11-13): number precedence, beacon validation, source header, 15-minute follow-up rule.
// Run: npm test — pure helpers only, no DB.
import test from "node:test";
import assert from "node:assert/strict";
import { CALL_CLICK_HEADER, callClickNote, callClickSource, dialledLine, isPendingFollowUp, parseCallClick, touchForCall } from "../src/lib/call-click";
import { CONTACT } from "../src/lib/marketing-content";
import { PRIMARY_CALL } from "../src/lib/contact-lines";

test("Shoaib's 89565 67130 is the primary calling number; WhatsApp stays on the Cloud API line", () => {
  assert.equal(CONTACT.call[0], "8956567130");
  assert.equal(PRIMARY_CALL, "8956567130");
  assert.notEqual(CONTACT.call[0], "9175220270");
});

test("dialledLine reads the digits of a tel: href and rejects everything else", () => {
  assert.equal(dialledLine("tel:+918956567130"), "8956567130");
  assert.equal(dialledLine("TEL:8956567130"), "8956567130");
  assert.equal(dialledLine("tel:+91%2089565%2067130"), "8956567130");
  assert.equal(dialledLine("https://wa.me/918956567130"), null);
  assert.equal(dialledLine("tel:12345"), null);
  assert.equal(dialledLine(null), null);
});

test("parseCallClick accepts only Sahara lines and clamps the attribution", () => {
  const ok = parseCallClick({ href: "tel:+918956567130", page: "/booking?x=1", attribution: { latest: { source: "google", medium: "cpc", gclid: "abc" } } });
  assert.ok(ok);
  assert.equal(ok!.line, "8956567130");
  assert.equal(ok!.page, "/booking");
  assert.equal(parseCallClick({ href: "tel:+919999999999" }), null);
  assert.equal(parseCallClick({ href: "mailto:a@b.c" }), null);
  assert.equal(parseCallClick("nope"), null);
});

test("source header: Google Ads, Meta Ads, everything else on the website reads [SEO-WEB]", () => {
  assert.equal(callClickSource({ source: "google", medium: "cpc", campaign: "east_pune_pilot", gclid: "x" }).header, "[GOOGLE-ADS]");
  assert.equal(callClickSource({ source: "facebook", medium: "paid", fbclid: "y" }).header, "[META-ADS]");
  assert.equal(callClickSource({ referrer: "https://www.google.com/" }).header, "[SEO-WEB]");
  assert.equal(callClickSource(null).header, "[SEO-WEB]");
  assert.equal(callClickSource(null).channel, "Website Direct");
});

test("the latest touch wins when it carries a signal, else the first touch explains the tap", () => {
  const first = { source: "google", medium: "cpc", gclid: "g" };
  assert.equal(touchForCall({ first, latest: { at: "2026-11-13T00:00:00Z" } }), first);
  const latest = { source: "facebook", medium: "paid" };
  assert.equal(touchForCall({ first, latest }), latest);
});

test("the lead note carries header, source, IST timestamp, line, page and UTMs", () => {
  const input = parseCallClick({ href: "tel:+918956567130", page: "/booking", attribution: { latest: { source: "google", medium: "cpc", campaign: "east_pune_pilot", gclid: "x" } } })!;
  const note = callClickNote(input, callClickSource(touchForCall(input.attribution)), new Date("2026-11-13T09:30:00Z"));
  assert.ok(note.startsWith(`${CALL_CLICK_HEADER} [GOOGLE-ADS]`));
  assert.match(note, /3:00 pm IST/i);
  assert.match(note, /8956567130 from \/booking/);
  assert.match(note, /utm_campaign=east_pune_pilot/);
});

test("Pending Follow-up: NEW, uncalled and 15+ minutes old", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000);
  assert.equal(isPendingFollowUp({ stage: "NEW", createdAt: at(14), called: false }, now), false);
  assert.equal(isPendingFollowUp({ stage: "NEW", createdAt: at(15), called: false }, now), true);
  assert.equal(isPendingFollowUp({ stage: "NEW", createdAt: at(60), called: true }, now), false);
  assert.equal(isPendingFollowUp({ stage: "INTERESTED", createdAt: at(60), called: false }, now), false);
});
