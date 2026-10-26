// One submitted lead = exactly one event per ad platform (no double counting). Run: npm run test:leadtrack
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

test("trackLead fires Meta Lead once and GA4 generate_lead once per call", async () => {
  const calls: unknown[][] = [];
  const g = globalThis as unknown as { window: unknown; fbq?: unknown; gtag?: unknown };
  const fbq = (...a: unknown[]) => calls.push(["fbq", ...a]);
  const gtag = (...a: unknown[]) => calls.push(["gtag", ...a]);
  g.window = { fbq, gtag, location: { pathname: "/booking" } };
  try {
    const { trackLead } = await import("../src/components/public/marketing-tags");
    trackLead({ category: "HOME_DEEP_CLEANING", variant: "2 BHK Premium" });
    const metaLeads = calls.filter((c) => c[0] === "fbq" && c[1] === "track" && c[2] === "Lead");
    assert.equal(metaLeads.length, 1, "exactly one Meta Lead");
    assert.deepEqual(metaLeads[0][3], { content_name: "2 BHK Premium", content_category: "HOME_DEEP_CLEANING" });
    assert.equal(calls.filter((c) => c[0] === "gtag" && c[2] === "generate_lead").length, 1, "exactly one GA4 generate_lead");
  } finally {
    delete (g as { window?: unknown }).window;
  }
});

test("no component sends its own Meta Lead — only trackLead does", () => {
  const root = path.join(process.cwd(), "src");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== "generated") walk(p); continue; }
      if (!/\.(tsx?|jsx?)$/.test(name)) continue;
      const src = readFileSync(p, "utf8");
      const metaLead = ['"track", "Lead"', '"track","Lead"', "'track', 'Lead'", "'track','Lead'"].some((s) => src.includes(s));
      if (metaLead) hits.push(path.relative(process.cwd(), p).split(path.sep).join("/"));
    }
  };
  walk(root);
  assert.deepEqual(hits, ["src/components/public/marketing-tags.tsx"]);
});
