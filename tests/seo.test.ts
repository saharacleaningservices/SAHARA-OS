// SEO regression guard for the public booking host (2026-10-15). Run: npm run build && npm run test:seo
//
// Starts the already-built app (`next start`) on a free port with a throwaway SQLite DB and the production
// host split (BOOKING_URL / CRM_URL), then checks what search engines see: sitemap, robots, titles, descriptions,
// canonicals, headings, JSON-LD, image alt text, noindex on PPC landing pages and that important routes stay up.
// No network access, no tracking IDs, no WhatsApp/SMS/e-mail; never touches dev.db.
//
// Hard checks protect what is already correct today. Advisory findings (titles/descriptions longer than the
// ideal search-snippet length) are printed as diagnostics, not failures, so the suite stays green on the current
// production content while still surfacing the gap.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PUNE_AREAS } from "../src/lib/pune-areas";

const BOOKING = "https://booking.saharacleaningservices.com";
const CRM = "https://crm.saharacleaningservices.com";
const BOOKING_HOST = new URL(BOOKING).host;
const CRM_HOST = new URL(CRM).host;

// Mirrors src/app/sitemap.ts on purpose: a route disappearing from the sitemap (or the page) must fail a test.
const PACKAGE_PATHS = ["1-bhk", "2-bhk", "3-bhk"].flatMap((b) => ["premium", "platinum"].map((t) => `/home-deep-cleaning-pune/${b}-${t}`));
const INDEXABLE = ["/booking", "/offers", "/home-deep-cleaning-pune", ...PACKAGE_PATHS, "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/housekeeping-services", "/gallery", "/pune", ...PUNE_AREAS.map((a) => `/pune/${a.slug}`)];
const LANDING = ["/landing/home-deep-cleaning-pune", "/landing/interior-painting-pune", "/landing/office-commercial-cleaning-pune", "/landing/pest-control-services-pune"];
// Public pages that must keep answering 200 but are not meant for the sitemap.
const OTHER_PUBLIC = ["/privacy-policy", "/terms"];
// Pages where structured data is not required today.
const NO_JSON_LD = new Set(["/gallery"]);

const dir = mkdtempSync(path.join(tmpdir(), "sahara-seo-"));
const dbFile = path.join(dir, "test.db");
let server: ChildProcess | undefined;
let port = 0;

type Res = { status: number; headers: http.IncomingHttpHeaders; body: string };
const get = (p: string, host = BOOKING_HOST) =>
  new Promise<Res>((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: p, headers: { host, "user-agent": "seo-test" } }, (r) => {
      let body = "";
      r.setEncoding("utf8");
      r.on("data", (c) => (body += c));
      r.on("end", () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body }));
    });
    req.setTimeout(60_000, () => req.destroy(new Error(`timeout ${p}`)));
    req.on("error", reject);
  });

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const htmlOf = (b: string) => b.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const title = (b: string) => strip(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(b)?.[1] ?? "");
const metaContent = (b: string, name: string) => {
  const tag = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]*>`, "i").exec(b)?.[0] ?? "";
  return strip(/content="([^"]*)"/i.exec(tag)?.[1] ?? "");
};
const canonical = (b: string) => {
  const tag = /<link[^>]+rel="canonical"[^>]*>/i.exec(b)?.[0] ?? "";
  return /href="([^"]*)"/i.exec(tag)?.[1] ?? "";
};
const headings = (b: string) => [...htmlOf(b).matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: strip(m[2]) }));
const jsonLd = (b: string) => [...b.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => JSON.parse(m[1]));
const flatTypes = (blocks: unknown[]): string[] => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      const t = (n as Record<string, unknown>)["@type"];
      if (typeof t === "string") out.push(t);
      else if (Array.isArray(t)) out.push(...(t as string[]));
      Object.values(n as object).forEach(walk);
    }
  };
  blocks.forEach(walk);
  return out;
};
const robotsMeta = (b: string) => metaContent(b, "robots").toLowerCase();

test.before(async () => {
  assert.ok(existsSync(path.join(process.cwd(), ".next", "BUILD_ID")), "No production build found — run `npm run build` first.");
  const env = { ...process.env, DATABASE_URL: `file:${dbFile}` };
  execFileSync("node", ["scripts/db-setup.mjs"], { env, stdio: "ignore" });
  port = await freePort();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: {
      ...env,
      BOOKING_URL: BOOKING,
      CRM_URL: CRM,
      OPS_REMINDERS_SCHEDULER: "off",
      WHATSAPP_OUTBOUND_MODE: "test",
      NEXT_PUBLIC_GA4_ID: "",
      NEXT_PUBLIC_GOOGLE_ADS_ID: "",
      NEXT_PUBLIC_META_PIXEL_ID: "",
    },
    stdio: "ignore",
  });
  const t0 = Date.now();
  for (;;) {
    try {
      if ((await get("/robots.txt")).status === 200) break;
    } catch {
      /* not up yet */
    }
    assert.ok(Date.now() - t0 < 90_000, "next start did not become ready within 90 s");
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.after(() => {
  server?.kill();
  setTimeout(() => rmSync(dir, { recursive: true, force: true }), 500).unref();
});

test("sitemap.xml lists exactly the indexable public pages, on one origin, without duplicates", async () => {
  const r = await get("/sitemap.xml");
  assert.equal(r.status, 200);
  assert.match(String(r.headers["content-type"]), /xml/);
  const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const origins = new Set(locs.map((l) => new URL(l).origin));
  assert.equal(origins.size, 1, `sitemap mixes origins: ${[...origins].join(", ")}`);
  const origin = [...origins][0];
  assert.deepEqual([...locs].sort(), INDEXABLE.map((p) => `${origin}${p}`).sort());
  assert.equal(new Set(locs).size, locs.length, "duplicate sitemap entries");
  for (const l of locs) assert.ok(!/\/(landing|api|my|login|j)(\/|$)/.test(new URL(l).pathname), `non-indexable path in sitemap: ${l}`);
  // The sitemap is prerendered at BUILD time (canonicals are computed per request), so its origin is whatever BOOKING_URL was
  // when `npm run build` ran. Production must be built with BOOKING_URL set; check that before a release with SEO_STRICT_ORIGIN=1.
  if (origin !== BOOKING) {
    if (process.env.SEO_STRICT_ORIGIN === "1") assert.equal(origin, BOOKING, `sitemap origin ${origin} — rebuild with BOOKING_URL=${BOOKING}`);
    else console.log(`# ADVISORY: sitemap origin is ${origin} (this build had no BOOKING_URL). Production must show ${BOOKING}; set SEO_STRICT_ORIGIN=1 after \`BOOKING_URL=${BOOKING} npm run build\`.`);
  }
});

test("robots.txt: booking host is crawlable but private areas are blocked; every other host is disallowed entirely", async () => {
  const pub = await get("/robots.txt", BOOKING_HOST);
  assert.equal(pub.status, 200);
  assert.match(pub.body, /User-Agent: \*/i);
  assert.match(pub.body, /^Allow: \/$/im);
  for (const p of ["/api/", "/j/", "/my", "/login", "/uploads/"]) assert.match(pub.body, new RegExp(`^Disallow: ${p.replace(/\//g, "\\/")}$`, "im"), `robots must block ${p}`);
  assert.match(pub.body, new RegExp(`^Sitemap: ${BOOKING.replace(/\./g, "\\.")}/sitemap\\.xml$`, "im"));
  const crm = await get("/robots.txt", CRM_HOST);
  assert.match(crm.body, /^Disallow: \/$/im, "CRM host must disallow everything");
  assert.doesNotMatch(crm.body, /^Allow:/im);
});

test("every indexable page: 200, indexable, unique title, description, self-canonical", async () => {
  const seenTitles = new Map<string, string>();
  const advisory: string[] = [];
  for (const p of INDEXABLE) {
    const r = await get(p);
    assert.equal(r.status, 200, `${p} status`);
    assert.doesNotMatch(robotsMeta(r.body), /noindex/, `${p} must be indexable`);
    assert.doesNotMatch(String(r.headers["x-robots-tag"] ?? ""), /noindex/i, `${p} X-Robots-Tag`);
    const t = title(r.body);
    assert.ok(t.length >= 20 && t.length <= 90, `${p} title length ${t.length}: "${t}"`);
    assert.ok(!seenTitles.has(t), `${p} duplicate title with ${seenTitles.get(t)}: "${t}"`);
    seenTitles.set(t, p);
    const d = metaContent(r.body, "description");
    assert.ok(d.length >= 50 && d.length <= 300, `${p} description length ${d.length}`);
    assert.equal(canonical(r.body), `${BOOKING}${p}`, `${p} canonical`);
    if (t.length > 60) advisory.push(`${p} title ${t.length} chars`);
    if (d.length > 160) advisory.push(`${p} description ${d.length} chars`);
  }
  if (advisory.length) console.log(`# ADVISORY (not failures) — longer than the ideal search snippet (title 60 / description 160): ${advisory.length}\n# ${advisory.join("\n# ")}`);
});

test("every indexable page: exactly one H1, no skipped heading levels, non-empty headings", async () => {
  for (const p of INDEXABLE) {
    const hs = headings((await get(p)).body);
    assert.equal(hs.filter((h) => h.level === 1).length, 1, `${p} must have exactly one H1 (found ${hs.filter((h) => h.level === 1).map((h) => h.text).join(" | ") || "none"})`);
    assert.equal(hs[0]?.level, 1, `${p} first heading should be the H1`);
    hs.forEach((h, i) => {
      assert.ok(h.text.length > 0, `${p} empty h${h.level}`);
      if (i > 0) assert.ok(h.level <= hs[i - 1].level + 1, `${p} heading jumps from h${hs[i - 1].level} to h${h.level} ("${h.text}")`);
    });
  }
});

test("structured data: JSON-LD parses and keeps the business/FAQ types", async () => {
  for (const p of INDEXABLE) {
    const blocks = jsonLd((await get(p)).body);
    if (NO_JSON_LD.has(p)) continue;
    const types = flatTypes(blocks);
    assert.ok(blocks.length >= 1, `${p} has no JSON-LD`);
    assert.ok(types.includes("HomeAndConstructionBusiness"), `${p} lost the LocalBusiness block`);
  }
  for (const p of ["/offers", "/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/housekeeping-services"]) {
    assert.ok(flatTypes(jsonLd((await get(p)).body)).includes("FAQPage"), `${p} lost FAQPage`);
  }
});

test("images: every <img> on indexable pages carries an alt attribute (decorative images use alt=\"\")", async () => {
  for (const p of INDEXABLE) {
    const imgs = [...(await get(p)).body.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    for (const tag of imgs) assert.match(tag, /\salt="/i, `${p}: <img> without alt: ${tag.slice(0, 120)}`);
  }
});

test("PPC landing pages stay noindex (and out of the sitemap) so they never compete with the SEO pages", async () => {
  for (const p of LANDING) {
    const r = await get(p);
    assert.equal(r.status, 200, `${p} status`);
    const noindex = /noindex/.test(robotsMeta(r.body)) || /noindex/i.test(String(r.headers["x-robots-tag"] ?? ""));
    assert.ok(noindex, `${p} must be noindex`);
  }
});

test("important public routes keep working; the legacy /privacy URL still 308-redirects", async () => {
  for (const p of [...INDEXABLE, ...LANDING, ...OTHER_PUBLIC]) assert.equal((await get(p)).status, 200, `${p} should be 200`);
  const r = await get("/privacy");
  assert.equal(r.status, 308);
  assert.match(String(r.headers.location), /\/privacy-policy$/);
  // Legacy booking-form URL used by old ads/links: temporary redirect to /booking, query string (UTMs) carried over.
  const b = await get("/book?utm_source=test&category=PEST_CONTROL");
  assert.equal(b.status, 307);
  const loc = new URL(String(b.headers.location), BOOKING);
  assert.equal(loc.pathname, "/booking");
  assert.equal(loc.searchParams.get("utm_source"), "test");
  assert.equal(loc.searchParams.get("service"), "pest");
});

test("CRM-only areas are not served on the public booking host", async () => {
  for (const p of ["/dashboard", "/leads", "/jobs", "/payments", "/settings", "/api/backup"]) {
    const r = await get(p, BOOKING_HOST);
    assert.notEqual(r.status, 200, `${p} must not be a 200 page on ${BOOKING_HOST}`);
  }
});

test("campaign pages do not embed Google Maps on load: static card + 'View on Google Maps' link, iframe only after a tap", async () => {
  for (const p of ["/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune"]) {
    const b = (await get(p)).body;
    assert.doesNotMatch(b, /<iframe[^>]+google\.com\/maps/i, `${p} embeds the Google Map on load (~450 KiB of Google JS)`);
    assert.match(b, /View on Google Maps/, `${p} lost the map link`);
    assert.match(b, /Show map here/, `${p} lost the tap-to-load button`);
    assert.match(b, /href="https:\/\/www\.google\.com\/maps\/place\/Sahara\+Cleaning\+Services[^"]*"/, `${p}: map link should open the Business Profile listing`);
  }
});

test("marketing tags stay off while no tracking IDs are configured (no accidental tracking, no agency container)", async () => {
  for (const p of ["/home-deep-cleaning-pune", "/landing/home-deep-cleaning-pune", "/book"]) {
    const b = (await get(p)).body;
    assert.doesNotMatch(b, /googletagmanager\.com|connect\.facebook\.net|fbq\(|GTM-[A-Z0-9]+/, `${p} loads a tracking script without IDs`);
  }
});
