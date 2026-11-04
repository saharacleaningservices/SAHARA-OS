// Customer category tag + lazy history drawer rules. Run: npm run test:category
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORY_OPTIONS, CONTACT_TYPE_LABEL, categoryChoices, categoryLabel, isContactType } from "../src/lib/contact-category";

test("owner categories with owner wording (Architect pickable since 2026-11-04); unknown/empty falls back to Direct Customer", () => {
  assert.deepEqual(CATEGORY_OPTIONS.map((c) => CONTACT_TYPE_LABEL[c]), ["Direct Customer", "Broker", "Architect", "Interior Designer", "Vendor", "AMC Client", "Commercial / B2B Partner"]);
  assert.equal(categoryLabel(null), "Direct Customer");
  assert.equal(categoryLabel("nonsense"), "Direct Customer");
  assert.ok(isContactType("VENDOR") && isContactType("AMC_CLIENT") && !isContactType("CUVS"));
});

test("Architect is always pickable; legacy Society stays readable and only appears for records that have it", () => {
  assert.equal(categoryLabel("ARCHITECT"), "Architect");
  assert.ok(categoryChoices("CUSTOMER").includes("ARCHITECT" as never));
  assert.ok(!categoryChoices("CUSTOMER").includes("SOCIETY" as never));
  assert.ok(categoryChoices("SOCIETY").includes("SOCIETY" as never));
});

test("history API: lazy route, staff blocked, Operations by in-scope job only and without money/mobile", () => {
  const src = readFileSync("src/app/api/customers/history/route.ts", "utf8");
  assert.ok(src.includes("!office && role !== \"OPERATIONS\""), "STAFF/SUPERVISOR get 403");
  assert.ok(src.includes("jobDateWindowForRole(role)"), "Operations limited to own job window");
  assert.ok(/\.\.\.\(office \? \{ mobile: key \}/.test(src), "mobile only for office roles");
  assert.ok(/\.\.\.\(showMoney \? \{ lifetimeValue/.test(src), "lifetime value only for revenue roles");
  assert.ok(/showMoney && q/.test(src), "quotation links only for revenue roles");
  const drawer = readFileSync("src/components/customers/customer-history-drawer.tsx", "utf8");
  assert.ok(drawer.includes("if (!data) void load()"), "fetched on open, cached after");
});
