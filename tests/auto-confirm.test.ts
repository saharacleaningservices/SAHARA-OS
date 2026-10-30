import { test } from "node:test";
import assert from "node:assert/strict";
import { autoConfirmEligible, AUTO_CONFIRM_DEFAULT_FROM } from "../src/lib/auto-confirm-rule";

const base = { serviceDate: "2026-11-09", timeSlot: "10:00 AM – 12:00 PM", serviceCategory: "PEST_CONTROL", inspectionRequired: false };

test("fixed-price booking on an open window from the start date is auto-confirmed", () => {
  assert.deepEqual(autoConfirmEligible(base, {}), { ok: true });
  assert.deepEqual(autoConfirmEligible({ ...base, serviceDate: AUTO_CONFIRM_DEFAULT_FROM, serviceCategory: "HOME_DEEP_CLEANING" }, {}), { ok: true });
  assert.deepEqual(autoConfirmEligible({ ...base, timeSlot: "4:00 – 6:00 PM", serviceCategory: "INDIVIDUAL_CLEANING" }, {}), { ok: true });
});

test("dates before the start date stay requests", () => {
  assert.equal(autoConfirmEligible({ ...base, serviceDate: "2026-11-05" }, {}).ok, false);
  assert.equal(autoConfirmEligible({ ...base, serviceDate: "2026-11-05" }, { PUBLIC_AUTO_CONFIRM_FROM: "2026-11-01" }).ok, true);
});

test("inspection / custom-quote work, flexible or unknown windows are never auto-confirmed", () => {
  assert.equal(autoConfirmEligible({ ...base, inspectionRequired: true }, {}).ok, false);
  for (const c of ["PAINTING", "COMMERCIAL_CLEANING", "HOUSEKEEPING", "", null]) assert.equal(autoConfirmEligible({ ...base, serviceCategory: c }, {}).ok, false);
  for (const t of ["Flexible", "", null, "9 AM - 12 PM"]) assert.equal(autoConfirmEligible({ ...base, timeSlot: t }, {}).ok, false);
});

test("kill switch", () => {
  assert.deepEqual(autoConfirmEligible(base, { PUBLIC_AUTO_CONFIRM: "off" }), { ok: false, reason: "disabled" });
});
