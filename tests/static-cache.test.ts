// next.config.ts response headers: brand/marketing images get a short public cache; security headers stay global;
// uploads and the service worker are never given a long cache. Run: npm run test:cache
import test from "node:test";
import assert from "node:assert/strict";

type Rule = { source: string; headers: { key: string; value: string }[] };
const load = async (): Promise<Rule[]> => {
  const cfg = (await import("../next.config")).default as { headers: () => Promise<Rule[]> };
  return cfg.headers();
};
const cacheFor = (rules: Rule[], source: string) => rules.find((r) => r.source === source)?.headers.find((h) => h.key === "Cache-Control")?.value;

test("brand, marketing and logo images: 1-day public cache with stale-while-revalidate", async () => {
  const rules = await load();
  for (const dir of ["brand", "marketing", "logo"]) {
    assert.equal(cacheFor(rules, `/${dir}/:path*`), "public, max-age=86400, stale-while-revalidate=604800", dir);
  }
});

test("uploads and the service worker get no long cache rule", async () => {
  const rules = await load();
  for (const r of rules.filter((x) => x.headers.some((h) => h.key === "Cache-Control"))) {
    assert.ok(!/uploads|sw.js/.test(r.source), `cache rule must not cover ${r.source}`);
  }
  assert.equal(cacheFor(rules, "/uploads/:path*"), undefined);
  assert.equal(cacheFor(rules, "/sw.js"), undefined);
});

test("security headers still apply to every path", async () => {
  const rules = await load();
  const all = rules.find((r) => r.source === "/:path*")!;
  for (const key of ["X-Frame-Options", "X-Content-Type-Options", "Strict-Transport-Security"]) assert.ok(all.headers.some((h) => h.key === key), key);
});
