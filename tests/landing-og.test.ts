// Every public service landing page declares Open Graph metadata, so shared links (WhatsApp, Facebook, LinkedIn)
// show a title, description and image. Run: npm run test:og
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGES = ["booking", "offers", "home-deep-cleaning-pune", "commercial-cleaning-pune", "pest-control-pune", "interior-painting-pune", "housekeeping-services"];

test("service landing pages declare openGraph with url and image", () => {
  for (const p of PAGES) {
    const src = readFileSync(`src/app/${p}/page.tsx`, "utf8");
    assert.ok(/openGraph:\s*\{/.test(src), `${p} has openGraph`);
    assert.ok(/openGraph:[^\n]*images:/.test(src) || /openGraph:\s*\{[\s\S]{0,600}images:/.test(src), `${p} openGraph has images`);
  }
});
