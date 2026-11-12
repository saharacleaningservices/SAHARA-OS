import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ALL_PINS, BRANCHES, LOCALITIES, PROGRAMMATIC_PAGES, SERVICE_CATEGORIES, ZONES, IT_PARKS, TOWNSHIPS, branchForLocality, localityBySlug, whatsappTextFor } from "../src/config/pune-seo-matrix";
import { seoDescription, seoTitle, pageFaqs } from "../src/lib/seo-copy";
import { sourceLineForNumber } from "../src/lib/source-line";

test("matrix covers every owner-listed locality in the right zone", () => {
  const need: Record<string, string[]> = {
    east: ["magarpatta", "hadapsar", "kharadi", "mundhwa", "manjri", "wagholi"],
    "west-pcmc": ["wakad", "baner", "balewadi", "hinjewadi", "sus", "pashan", "sutarwadi", "aundh", "pimple-saudagar", "pimple-nilakh", "bavdhan", "pimpri", "chinchwad", "bhosari"],
    north: ["viman-nagar", "kalyani-nagar", "koregaon-park", "yerwada", "dhanori", "vishrantwadi"],
    "south-central": ["nibm", "kondhwa", "wanowrie", "undri", "katraj", "dhankawadi", "bibwewadi", "balaji-nagar", "kothrud", "shivajinagar"],
  };
  for (const [zone, slugs] of Object.entries(need)) for (const s of slugs) assert.equal(localityBySlug(s)?.zone, zone, `${s} should be in ${zone}`);
  assert.equal(Object.keys(ZONES).length, 4);
});

test("slugs unique, PINs are 6 digits, near-links resolve", () => {
  assert.equal(new Set(LOCALITIES.map((l) => l.slug)).size, LOCALITIES.length);
  for (const l of LOCALITIES) {
    assert.ok(l.pins.length > 0 && l.pins.every((p) => /^4[1-2]\d{4}$/.test(p)), l.slug);
    for (const n of l.near) assert.ok(localityBySlug(n), `${l.slug} → unknown near ${n}`);
  }
  assert.ok(ALL_PINS.length >= 25);
});

test("400+ programmatic pages with unique titles and descriptions", () => {
  assert.ok(PROGRAMMATIC_PAGES.length >= 400, String(PROGRAMMATIC_PAGES.length));
  const titles = new Set<string>(), descs = new Set<string>();
  for (const c of SERVICE_CATEGORIES) for (const l of LOCALITIES) {
    titles.add(seoTitle(c, l));
    descs.add(seoDescription(c, l));
    assert.ok(seoDescription(c, l).length <= 160);
  }
  assert.equal(titles.size, PROGRAMMATIC_PAGES.length);
  assert.equal(descs.size, PROGRAMMATIC_PAGES.length);
});

test("5 verticals only; waterproofing / wallpaper never appear in the SEO engine or the public surface", () => {
  assert.deepEqual([...new Set(SERVICE_CATEGORIES.map((c) => c.vertical))].sort(), ["commercial", "painting", "pest", "post-interior", "residential"]);
  const dump = JSON.stringify(SERVICE_CATEGORIES.map((c) => ({ ...c, faq: c.faq("X") }))) + JSON.stringify(LOCALITIES);
  assert.ok(!/waterproof|wallpaper/i.test(dump));
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk("src/app"), ...walk("src/config"), ...walk("src/components/public"), "src/lib/whatsapp-chatbot.ts", "src/lib/seo-schema.ts", "src/lib/seo-graph.ts", "src/lib/pune-areas.ts"];
  for (const f of files) assert.ok(!/waterproof|wallpaper/i.test(readFileSync(f, "utf8")), `${f} mentions an excluded service`);
});

test("branches: Magarpatta = Main-API 9175220270, Mohammadwadi = Shoyab-GMB 7083347130; every locality gets one", () => {
  assert.equal(BRANCHES.magarpatta.whatsapp, "9175220270");
  assert.equal(BRANCHES.mohammadwadi.whatsapp, "7083347130");
  assert.equal(sourceLineForNumber(BRANCHES.magarpatta.whatsapp, {}), BRANCHES.magarpatta.sourceLine);
  assert.equal(sourceLineForNumber(BRANCHES.mohammadwadi.whatsapp, {}), BRANCHES.mohammadwadi.sourceLine);
  for (const l of LOCALITIES) assert.ok(branchForLocality(l));
});

test("WhatsApp CTA text carries area, PIN, vertical and branch", () => {
  const c = SERVICE_CATEGORIES.find((x) => x.slug === "post-interior-cleaning")!;
  const l = localityBySlug("kharadi")!;
  const t = whatsappTextFor(c, l);
  assert.match(t, /Kharadi/); assert.match(t, /411014/); assert.match(t, /post-interior/); assert.match(t, /Magarpatta/);
});

test("IT parks and townships from the brief are present; no prices or superlatives in generated copy", () => {
  for (const n of ["EON IT Park", "Cybercity Magarpatta", "Commerzone"]) assert.ok(IT_PARKS.some((p) => p.name.includes(n)));
  for (const n of ["Amanora", "Megapolis", "Nyati", "Trump Towers"]) assert.ok(TOWNSHIPS.some((t) => t.name.includes(n)));
  for (const c of SERVICE_CATEGORIES) for (const l of LOCALITIES.slice(0, 5)) {
    const all = [seoTitle(c, l), seoDescription(c, l), ...pageFaqs(c, l).flatMap((f) => [f.q, f.a])].join(" ");
    assert.ok(!/₹|\bRs\.?\s?\d|\b(best|#1|number one|cheapest|lowest price)\b/i.test(all), `${c.slug}/${l.slug}`);
  }
});
