import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceLabelForTag, withSourceHeader } from "../src/lib/source-label";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("booking wizard: Meta/GA4/Ads Lead fires once at the completed booking, not at step 1", () => {
  const flow = read("src/components/public/booking-flow.tsx");
  const fireLead = /function fireLead\(\) \{([\s\S]*?)\n  \}/.exec(flow)?.[1] ?? "";
  assert.ok(!fireLead.includes("trackLead"), "step 1 must not send the ad-platform Lead");
  const finish = /function finish\([^)]*\) \{([\s\S]*?)\n  \}/.exec(flow)?.[1] ?? "";
  assert.match(finish, /trackLead\(\{[^}]*kind: "booking"[^}]*confirmed[^}]*\}\)/);
  assert.match(finish, /id: d\.id/, "job / lead number is the dedupe id");
  assert.ok(finish.indexOf("trackLead") < finish.indexOf("trackPurchase"));
});

test("alert headers use GBP and the landing page is added", () => {
  assert.equal(sourceLabelForTag("SRC-GMB-MAGARPATTA").header, "[GBP-MAGARPATTA]");
  assert.equal(sourceLabelForTag("SRC-GMB-MOHAMMADWADI").header, "[GBP-MOHAMMADWADI]");
  const out = withSourceHeader("New booking", sourceLabelForTag("SRC-GOOGLE-ADS"), "/services/sofa-cleaning?gclid=abc");
  assert.equal(out, "[GOOGLE-ADS]\nNew booking\n🏷️ Source: Google Ads\n📄 Page: /services/sofa-cleaning");
  assert.ok(!withSourceHeader("x", sourceLabelForTag(""), "/").includes("Page:"));
  assert.ok(!withSourceHeader("x", sourceLabelForTag("")).includes("Page:"));
});
