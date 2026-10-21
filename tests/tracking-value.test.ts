import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCapiPayload } from "../src/lib/meta-capi";

const base = { eventName: "Lead" as const, eventId: "evt-12345678", sourceUrl: "https://booking.saharacleaningservices.com/booking", mobile: "9876543210", category: "HOME_DEEP_CLEANING", variant: "2 BHK Premium", now: 1_800_000_000_000 };

test("CAPI Lead carries the booking value in INR when there is one", () => {
  const cd = buildCapiPayload({ ...base, value: 6499 }).data[0].custom_data as Record<string, unknown>;
  assert.equal(cd.value, 6499);
  assert.equal(cd.currency, "INR");
});

test("no value (inspection / unpriced) means no value or currency is sent", () => {
  for (const v of [undefined, 0]) {
    const cd = buildCapiPayload({ ...base, value: v }).data[0].custom_data as Record<string, unknown>;
    assert.equal("value" in cd, false);
    assert.equal("currency" in cd, false);
  }
});

test("the phone is hashed and never sent in the clear", () => {
  const json = JSON.stringify(buildCapiPayload({ ...base, value: 5499 }));
  assert.ok(!json.includes("9876543210"));
});
