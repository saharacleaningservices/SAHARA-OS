import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCompletion, paymentRecordLabel, STAFF_COLLECT_MODES, COLLECT_MODE_LABELS, generateStartOtp } from "../src/lib/field-ops";
import { bookingConfirmationOtpParams } from "../src/server/booking-messages";
import { premiumBookingConfirmationMessage } from "../src/lib/whatsapp-templates";
import { BOOKING_OTP_TEMPLATE_NAME, BOOKING_OTP_TEMPLATE_VARIABLES, CLOUD_TEMPLATES, templateByName, placeholderCount } from "../src/lib/whatsapp-cloud-templates";
import { WHATSAPP_TRANSACTIONAL_TEMPLATES } from "../src/lib/whatsapp";
import { SUBMITTABLE_TEMPLATES } from "../src/lib/meta-template-payload";
import { isZoneBPincode, moqFor } from "../src/lib/zonal-moq";

const done = { otpVerified: true, needsOtp: true };

test("start OTP: one 4-digit code, no completion OTP anywhere in the gate", () => {
  for (let i = 0; i < 200; i++) assert.match(generateStartOtp(), /^[1-9]\d{3}$/);
  // Completing needs the start OTP to have been verified, and nothing else OTP-related.
  assert.equal(checkCompletion({ amount: 1000, mode: "CASH", otpVerified: false, needsOtp: true, actor: "STAFF" }).ok, false);
  assert.equal(checkCompletion({ amount: 1000, mode: "CASH", ...done, actor: "STAFF" }).ok, true);
});

test("technician must pick UPI (with the proof confirmation) or Cash", () => {
  assert.deepEqual([...STAFF_COLLECT_MODES], ["UPI", "CASH"]);
  for (const mode of ["BANK", "PENDING_APPROVAL", "CREDIT_OVERRIDE", "", undefined]) assert.equal(checkCompletion({ amount: 1000, mode, ...done, note: "reason here", actor: "STAFF" }).ok, false, String(mode));
  assert.equal(checkCompletion({ amount: 1000, mode: "UPI", ...done, actor: "STAFF" }).ok, false, "UPI needs the confirmation tick");
  assert.equal(checkCompletion({ amount: 1000, mode: "UPI", ...done, actor: "STAFF", upiConfirmed: true }).ok, true);
  assert.equal(checkCompletion({ amount: 0, mode: "CASH", ...done, actor: "STAFF" }).ok, false, "no ₹0 closure");
});

test("Corporate / Credit Override is Admin-only and needs a reason", () => {
  assert.equal(checkCompletion({ amount: 0, mode: "CREDIT_OVERRIDE", note: "Corporate account", otpVerified: true, needsOtp: false, actor: "OFFICE" }).ok, false);
  assert.equal(checkCompletion({ amount: 0, mode: "CREDIT_OVERRIDE", note: "", otpVerified: true, needsOtp: false, actor: "ADMIN" }).ok, false);
  const r = checkCompletion({ amount: 0, mode: "CREDIT_OVERRIDE", note: "Corporate account, monthly invoice", otpVerified: true, needsOtp: false, actor: "ADMIN" });
  assert.equal(r.ok, true);
  assert.equal(COLLECT_MODE_LABELS.CREDIT_OVERRIDE, "Corporate / Credit Override");
  // Office may close with UPI / Cash / Bank, never with Pending Approval.
  assert.equal(checkCompletion({ amount: 500, mode: "BANK", otpVerified: true, needsOtp: false, actor: "OFFICE" }).ok, true);
  assert.equal(checkCompletion({ amount: 500, mode: "PENDING_APPROVAL", note: "customer will pay later", otpVerified: true, needsOtp: false, actor: "OFFICE" }).ok, false);
});

test("payment record labels", () => {
  assert.equal(paymentRecordLabel("UPI", "Asha"), "Paid (UPI - Screenshot Shared)");
  const cash = paymentRecordLabel("CASH", "Asha", new Date("2026-11-14T09:00:00Z"));
  assert.match(cash, /^Paid \(Cash - Collected by Asha\)/);
  assert.match(cash, /Cash Collected by Asha, 14 Nov/);
});

test("Meta template v2: name, language, 8 placeholders, Service Start Code wording, v7 buttons, allowlisted and submittable", () => {
  const t = templateByName(BOOKING_OTP_TEMPLATE_NAME)!;
  assert.equal(t.name, "sahara_booking_confirmed_otp_v2");
  assert.equal(t.language, "en");
  assert.equal(t.category, "UTILITY");
  assert.equal(placeholderCount(t), 8);
  assert.equal(BOOKING_OTP_TEMPLATE_VARIABLES.length, 8);
  assert.equal(t.examples.length, 8);
  assert.ok(t.body.includes("Service Start Code: {{8}}"));
  assert.ok(t.body.includes("Please share this 4-digit Service Start Code with our Sahara team upon arrival to start your service."));
  assert.ok(!/otp/i.test(t.body + (t.footer ?? "") + t.examples.join(" ")), "Meta rejected v1 for the word OTP: the v2 text must not contain it");
  const v7 = templateByName("sahara_booking_confirmed_v7")!;
  assert.deepEqual(t.buttons, v7.buttons, "same three buttons as the approved v7");
  assert.equal(t.footer, v7.footer);
  assert.ok(!/\{\{\d+\}\}\s*$/.test(t.body), "a variable may not be the last thing in the body");
  assert.ok((t.footer ?? "").length <= 60);
  assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes(t.name));
  assert.ok(SUBMITTABLE_TEMPLATES.includes(t.name));
  assert.equal(new Set(CLOUD_TEMPLATES.map((x) => x.name)).size, CLOUD_TEMPLATES.length, "unique names");
});

test("template parameters: one line each, OTP last, payable formatted", () => {
  const p = bookingConfirmationOtpParams({ customerName: "Priya\nS", jobNumber: "JOB-1", scheduledDate: new Date("2026-11-15T04:30:00Z"), scheduledTime: "10:00 AM", address: "Flat 4,\n  Kothrud", area: "Kothrud" }, "Full Home Deep Cleaning\n+ Chimney Deep Cleaning", 6098, "4821");
  assert.equal(p.length, 8);
  assert.ok(p.every((v) => !/[\n\t]/.test(v) && !/ {2,}/.test(v)));
  assert.equal(p[1], "JOB-1", "same {{1}}-{{6}} order as v7: name, booking ID, service, date, time, area");
  assert.equal(p[6], "₹6,098");
  assert.equal(p[7], "4821");
});

test("plain-text confirmation carries the OTP and the instruction", () => {
  const m = premiumBookingConfirmationMessage({ customerName: "Priya", jobNumber: "JOB-1", service: "Home Deep Cleaning", date: new Date(), timeSlot: "10:00 AM", area: "Kothrud", startOtp: "4821" });
  assert.ok(m.includes("4821"));
  assert.ok(m.includes("Please share this 4-digit Service Start Code with our Sahara team upon arrival to start your service."));
});

test("Deccan Gymkhana 411004 and Nigdi 411044 are Zone B (West Pune & PCMC)", () => {
  assert.ok(isZoneBPincode("411004") && isZoneBPincode("411044"));
  assert.equal(moqFor({ pincode: "411004" }).moq > 0, true);
  assert.equal(moqFor({ locality: "Deccan Gymkhana" }).moq > 0, true);
  assert.equal(moqFor({ locality: "Nigdi" }).moq > 0, true);
  assert.equal(isZoneBPincode("411028"), false);
});
