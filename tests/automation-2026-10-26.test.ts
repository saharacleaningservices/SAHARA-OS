// Owner 2026-10-26: booking target, call auto-responder, WhatsApp chatbot, review redirector, retention 3/6/12, footer links.
// Run: npm run test:automation
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CUSTOMER_BOOKING_URL, bookingLink } from "../src/lib/booking-target";
import { callerFrom, classifyCall, festivalWindow, planAutoReply, smsMode, prettyDate } from "../src/lib/call-autoresponder";
import { BOT_ROWS, botMenu, botReply, isBotRow, isBotTrigger } from "../src/lib/whatsapp-chatbot";
import { reviewRoute } from "../src/lib/review-route";
import { rebookMilestone, milestoneLabel } from "../src/lib/lifecycle-reminders";
import { templateByName, placeholderCount } from "../src/lib/whatsapp-cloud-templates";
import { COMPANY } from "../src/lib/constants";

const NOW = new Date("2026-10-26T06:00:00Z"); // 11:30 IST

test("booking target: saharacleaningservices.com/booking, service pre-select + UTM + #book", () => {
  assert.equal(CUSTOMER_BOOKING_URL, "https://saharacleaningservices.com/booking");
  assert.equal(bookingLink(), "https://saharacleaningservices.com/booking");
  assert.equal(bookingLink({ service: "home", source: "whatsapp", medium: "chatbot", campaign: "x" }), "https://saharacleaningservices.com/booking?service=home&utm_source=whatsapp&utm_medium=chatbot&utm_campaign=x#book");
});

test("GSTIN in code is a structurally valid GSTIN (state 27, PAN, entity digit, Z, checksum char)", () => {
  assert.match(COMPANY.gstin, /^27[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/);
});

test("call payloads: caller number + missed / answered classification across providers", () => {
  assert.equal(callerFrom({ CallFrom: "09876543210" }), "9876543210");
  assert.equal(callerFrom({ caller_number: "+91 98765 43210" }), "9876543210");
  assert.equal(callerFrom({ from: "12345" }), null);
  assert.equal(callerFrom({ from: "02024567890" }), null, "landline (not 6-9) → no WhatsApp/SMS");
  assert.equal(classifyCall({ status: "no-answer" }), "MISSED");
  assert.equal(classifyCall({ CallStatus: "busy" }), "MISSED");
  assert.equal(classifyCall({ status: "completed", duration: "0" }), "MISSED");
  assert.equal(classifyCall({ status: "completed", duration: "74" }), "ANSWERED");
  assert.equal(classifyCall({ event: "call_end", billsec: 30 }), "ANSWERED");
  assert.equal(classifyCall({ DialCallDuration: "0" }), "MISSED");
  assert.equal(classifyCall({}), "MISSED");
});

test("festival window: active up to and including FESTIVAL_FULL_UNTIL (IST), then off; bad dates ignored", () => {
  assert.deepEqual(festivalWindow("2026-11-05", NOW), { fullUntil: "2026-11-05", reopen: "2026-11-06" });
  assert.deepEqual(festivalWindow("2026-10-26", NOW), { fullUntil: "2026-10-26", reopen: "2026-10-27" });
  assert.equal(festivalWindow("2026-10-05", NOW), null, "5 Oct is past → regular replies");
  assert.equal(festivalWindow("5th Oct", NOW), null);
  assert.equal(festivalWindow(undefined, NOW), null);
  assert.equal(prettyDate("2026-11-06"), "6 Nov 2026");
});

test("auto-reply plan: festival notice for every caller; missed-call reply otherwise; answered → none; protected → none", () => {
  const fest = planAutoReply({ event: "ANSWERED", caller: "9876543210", now: NOW, festivalFullUntil: "2026-11-05" })!;
  assert.equal(fest.template, "festival_booking_full_notice");
  assert.deepEqual(fest.bodyParams, ["5 Nov 2026", "6 Nov 2026"]);
  assert.match(fest.preview, /100% booked until 5 Nov 2026/);
  assert.match(fest.sms, /saharacleaningservices\.com\/booking/);
  assert.ok(fest.sms.length <= 306, "fits 2 SMS segments");
  assert.ok(/^[\x20-\x7E]+$/.test(fest.sms), "GSM-safe ASCII only");

  const missed = planAutoReply({ event: "MISSED", caller: "9876543210", now: NOW, name: "Priya Sharma" })!;
  assert.equal(missed.template, "missed_call_auto_responder");
  assert.deepEqual(missed.bodyParams, ["Priya"]);
  assert.match(missed.sms, /saharacleaningservices\.com\/booking/);
  assert.equal(planAutoReply({ event: "MISSED", caller: "9876543210", now: NOW })!.bodyParams[0], "there");

  assert.equal(planAutoReply({ event: "ANSWERED", caller: "9876543210", now: NOW }), null);
  assert.equal(planAutoReply({ event: "MISSED", caller: "7083347130", now: NOW }), null, "own number never auto-replied");
  assert.equal(planAutoReply({ event: "MISSED", caller: null, now: NOW }), null);
  assert.deepEqual([smsMode(undefined), smsMode("fallback"), smsMode("OFF"), smsMode("x")], ["always", "fallback", "off", "always"]);
});

test("call templates: UTILITY, placeholders match examples, Book Now → booking target, ≤2 URL buttons, footer ≤60", () => {
  for (const name of ["festival_booking_full_notice", "missed_call_auto_responder"]) {
    const t = templateByName(name)!;
    assert.ok(t, name);
    assert.equal(t.category, "UTILITY");
    assert.equal(placeholderCount(t), t.examples.length);
    assert.equal(t.buttons!.find((b) => b.text === "Book Now" && b.type === "URL")!.type === "URL" && (t.buttons!.find((b) => b.text === "Book Now") as { url: string }).url, "https://saharacleaningservices.com/booking");
    assert.ok(t.buttons!.filter((b) => b.type === "URL").length <= 2);
    assert.ok((t.footer ?? "").length <= 60);
    assert.ok(t.body.length <= 1024);
  }
  assert.match(templateByName("festival_booking_full_notice")!.body, /4\.9★ by 1,800\+ customers on Google · GSTIN 27DMTPS3584R2ZJ/);
});

test("chatbot: greeting triggers, 4 menu rows within Meta limits, every reply links to the booking target", () => {
  for (const t of ["Hi", "hello!", "Hii", "price?", "Book now", "namaste", "slots"]) assert.ok(isBotTrigger(t), t);
  for (const t of ["STOP", "start", "I want to clean my 3BHK flat in Baner on Sunday, how much?", ""]) assert.ok(!isBotTrigger(t), t);
  const m = botMenu();
  assert.equal(m.rows.length, 4);
  assert.deepEqual(m.rows.map((r) => r.title), ["Home Deep Cleaning", "Sofa / Carpet Cleaning", "Commercial / Office", "Slot Availability"]);
  for (const r of BOT_ROWS) {
    assert.ok(r.title.length <= 24 && r.description.length <= 72 && r.id.length <= 200, r.id);
    assert.ok(isBotRow(r.id));
    assert.match(botReply(r.id)!, /https:\/\/saharacleaningservices\.com\/booking(\?|$|\s)/);
    assert.match(botReply(r.id)!, /utm_source=whatsapp&utm_medium=chatbot/);
  }
  assert.ok(m.bodyText.length <= 1024 && m.buttonLabel.length <= 20);
  assert.match(botReply("bot_home")!, /service=home/);
  assert.match(botReply("bot_commercial")!, /service=commercial/);
  assert.equal(botReply("reschedule"), null);
  assert.ok(!isBotRow("reschedule"));
});

test("review redirector: no rating → ask; 4–5★ → Google; 1–3★ → private feedback", () => {
  assert.deepEqual([null, 0, 1, 2, 3, 4, 5].map(reviewRoute), ["ASK", "ASK", "PRIVATE", "PRIVATE", "PRIVATE", "GOOGLE", "GOOGLE"]);
});

test("retention engine: 3 / 6 / 12-month re-booking windows", () => {
  const last = new Date("2026-04-20T06:30:00Z");
  assert.equal(rebookMilestone(last, new Date("2026-07-20T06:30:00Z")), 3);
  assert.equal(rebookMilestone(last, new Date("2026-08-10T06:30:00Z")), null);
  assert.equal(rebookMilestone(last, new Date("2026-10-20T06:30:00Z")), 6);
  assert.equal(rebookMilestone(last, new Date("2027-04-21T06:30:00Z")), 12);
  assert.deepEqual([3, 6, 12].map((m) => milestoneLabel(m as 3 | 6 | 12)), ["3 months", "6 months", "1 year"]);
});

test("/booking + footers: no 'from ₹' badge or Quick Quote on /booking, numbers under Book Now, booking-intent footer links", () => {
  const kit = readFileSync(path.join(process.cwd(), "src/components/public/landing-kit.tsx"), "utf8");
  const page = readFileSync(path.join(process.cwd(), "src/app/booking/page.tsx"), "utf8");
  assert.match(page, /variant="booking"/);
  assert.match(kit, /fromPrice != null && !isBooking/);
  assert.match(kit, /\{!isBooking && <div className="mt-4" id="hero-quote">/);
  assert.match(kit, /<BookingContactNumbers waText=\{waText\} \/>/);
  for (const s of ["home", "commercial", "painting", "pest"]) assert.ok(kit.includes(`/booking?service=${s}#book`), s);
  const campaign = readFileSync(path.join(process.cwd(), "src/components/public/campaign-kit.tsx"), "utf8");
  for (const s of ["home", "commercial", "painting", "pest"]) assert.ok(campaign.includes(`href: "/booking?service=${s}#book"`), `campaign ${s}`);
});
