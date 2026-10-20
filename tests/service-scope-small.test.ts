import { test } from "node:test";
import assert from "node:assert/strict";
import { SMALL_SERVICE_SCOPE, smallServiceScope } from "../src/lib/service-scope";
import { PRICING_MASTER } from "../src/lib/pricing-master";
import { fitWithin } from "../src/lib/image-compress";

test("every customised service in the pricing master has a written scope", () => {
  const missing = PRICING_MASTER.filter((p) => p.group === "CUSTOMISED" && !SMALL_SERVICE_SCOPE[p.contentId]).map((p) => `${p.contentId} ${p.name}`);
  assert.deepEqual(missing, []);
});

test("each scope lists inclusions, exclusions and customer prep, and promises no guarantee or timing", () => {
  for (const [id, s] of Object.entries(SMALL_SERVICE_SCOPE)) {
    assert.ok(s.includes.length >= 1 && s.excludes.length >= 1 && s.prep.length >= 1, id);
    const text = [...s.includes, ...s.excludes, ...s.prep].join(" ").toLowerCase();
    assert.ok(!/\bwarranty\b|100%|\bhours?\b|\bminutes?\b/.test(text), `${id} makes a promise`);
  }
  assert.ok(smallServiceScope("SCS-09")!.confirm.includes("confirmed before booking"));
  assert.equal(smallServiceScope("NOPE"), null);
});

test("fitWithin downsizes by the long edge and never upscales", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { w: 1600, h: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { w: 1200, h: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { w: 800, h: 600 });
});
