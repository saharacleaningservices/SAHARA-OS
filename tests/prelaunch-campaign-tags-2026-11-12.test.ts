// Pre-launch (2026-11-12): campaign-level source tags G1–G5 / M1–M5 and utm_content on the contact-form path.
// Pure-function and source-level checks: no network, no database.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campaignNumber, sourceTagForChannel, sourceTagChoices, CAMPAIGN_SOURCE_TAGS, isCampaignSourceTag } from "../src/lib/source-tags";

const read = (p: string) => readFileSync(p, "utf8");

test("campaign number is read only for the matching platform letter", () => {
  assert.equal(campaignNumber("g1_home_deep_clean", "g"), 1);
  assert.equal(campaignNumber("pune-meta-m3", "m"), 3);
  assert.equal(campaignNumber("G2", "g"), 2);
  assert.equal(campaignNumber("meta_g2", "m"), null);
  assert.equal(campaignNumber("brand_g10", "g"), null);
  assert.equal(campaignNumber("sig2", "g"), null);
  assert.equal(campaignNumber("summer-m6", "m"), null);
  assert.equal(campaignNumber(null, "g"), null);
});

test("Google/Meta Ads leads get the campaign tag, else the generic paid tag", () => {
  assert.equal(sourceTagForChannel("Google Ads", "G4_sofa"), "SRC-GOOGLE-G4");
  assert.equal(sourceTagForChannel("Meta Ads", "m5-commercial"), "SRC-META-M5");
  assert.equal(sourceTagForChannel("Google Ads", "brand-search"), "SRC-GOOGLE-ADS");
  assert.equal(sourceTagForChannel("Meta Ads"), "SRC-META-ADS");
  assert.equal(sourceTagForChannel("Meta Ads", "g1"), "SRC-META-ADS"); // a g# is not a Meta campaign
  assert.equal(sourceTagForChannel("Google Ads", "m1"), "SRC-GOOGLE-ADS");
});

test("non-paid channels are never tagged", () => {
  for (const ch of ["Organic Search", "Website Direct", "Referral", "Unattributed", null, undefined]) {
    assert.equal(sourceTagForChannel(ch as string | null, "g1"), null);
  }
});

test("picker offers every campaign tag and does not call them old values", () => {
  const values = sourceTagChoices().map((o) => o.value);
  for (const t of CAMPAIGN_SOURCE_TAGS) assert.ok(values.includes(t), t);
  assert.ok(isCampaignSourceTag("SRC-GOOGLE-G3"));
  const choices = sourceTagChoices("SRC-META-M2");
  assert.equal(choices.filter((o) => o.value === "SRC-META-M2").length, 1);
  assert.ok(!choices.some((o) => o.label.includes("old value")));
});

test("ten launch campaigns plus three manual tags", () => {
  assert.equal(CAMPAIGN_SOURCE_TAGS.length, 13);
  assert.ok((CAMPAIGN_SOURCE_TAGS as readonly string[]).includes("SRC-WA-4K-BLAST"));
});

test("every lead-creation path passes the campaign into the tag", () => {
  assert.match(read("src/server/public-booking-core.ts"), /sourceTagForChannel\(channel, firstTouch\?\.campaign\)/);
  assert.match(read("src/server/actions/booking-checkout.ts"), /sourceTagForChannel\(channel, first\?\.campaign\)/);
  assert.match(read("src/server/enquiry-intake.ts"), /sourceTagForChannel\(channel, utm\.campaign\)/);
});

test("utm_content survives the contact form into the lead", () => {
  assert.match(read("src/components/public/contact-form.tsx"), /utm_content: t\?\.content/);
  const intake = read("src/server/enquiry-intake.ts");
  assert.match(intake, /raw\.utm_content/);
  assert.match(intake, /utmContent: utm\.content/);
});
