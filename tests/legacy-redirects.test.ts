import test from "node:test";
import { CATALOG_SERVICES } from "../src/config/service-catalog";
import assert from "node:assert/strict";
import {
  AREA_SLUGS,
  SERVICE_SLUGS,
  LEGACY_REDIRECTS,
  SEGMENT_TO_SERVICE,
} from "../src/lib/legacy-redirects";

// Routes Sahara OS serves natively - a legacy redirect must never shadow one of them.
const NATIVE = new Set(["/", "/booking", "/offers", "/housekeeping-services", "/gallery", "/pune", "/services", "/contact", "/privacy-policy", "/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune"]);

// WordPress-era one-segment URLs from the live sitemap (29 Oct 2026 crawl + later additions), minus native routes.
const LEGACY_ONE_SEGMENT = `
video-gallery photo-gallery more-services online-booking about
cleaning-services-in-amanora-park cleaning-services-in-mohammadwadi cleaning-services-in-pune cleaning-services-in-undri cleaning-services-in-kharadi cleaning-services-in-hadapsar
deep-cleaning-services-in-undri deep-cleaning-services-in-pune deep-cleaning-services-in-amanora-park deep-cleaning-services-in-mohammadwadi deep-cleaning-services-in-kharadi deep-cleaning-services-in-hadapsar
home-deep-cleaning-services-in-pune home-deep-cleaning-services-in-undri home-deep-cleaning-services-in-amanora-park home-deep-cleaning-services-in-mohammadwadi home-deep-cleaning-services-in-hadapsar home-deep-cleaning-services-in-kharadi home-deep-cleaning-services-in-magarpatta home-deep-cleaning-services-in-viman-nagar home-deep-cleaning-services-in-baner home-deep-cleaning-services-in-wakad home-deep-cleaning-services-in-hinjewadi home-deep-cleaning-services-in-nibm home-deep-cleaning-services-in-kothrud home-deep-cleaning-services-in-pimple-saudagar
house-cleaning-services-in-pune house-cleaning-services-in-undri house-cleaning-services-in-amanora-park house-cleaning-services-in-mohammadwadi house-cleaning-services-in-hadapsar house-cleaning-services-in-kharadi
housekeeping-services-in-undri housekeeping-services-in-amanora-park housekeeping-services-in-mohammadwadi housekeeping-services-in-kharadi housekeeping-services-in-hadapsar housekeeping-services-in-wakad housekeeping-services-in-hinjewadi housekeeping-services-in-nibm housekeeping-services-in-pimple-saudagar
mattress-cleaning-services-in-pune mattress-cleaning-services-in-undri mattress-cleaning-services-in-amanora-park mattress-cleaning-services-in-mohammadwadi mattress-cleaning-services-in-kharadi mattress-cleaning-services-in-hadapsar
mattress-steam-services-in-kharadi mattress-steam-services-in-pune mattress-steam-services-in-undri mattress-steam-services-in-amanora-park mattress-steam-services-in-mohammadwadi mattress-steam-services-in-hadapsar
office-cleaning-services-in-undri office-cleaning-services-in-amanora-park office-cleaning-services-in-mohammadwadi office-cleaning-services-in-kharadi office-cleaning-services-in-hadapsar office-cleaning-services-in-hinjewadi office-cleaning-services-in-magarpatta office-cleaning-services-in-viman-nagar office-cleaning-services-in-baner
sofa-cleaning-services-in-pune sofa-cleaning-services-in-undri sofa-cleaning-services-in-amanora-park sofa-cleaning-services-in-mohammadwadi sofa-cleaning-services-in-kharadi sofa-cleaning-services-in-hadapsar
window-cleaning-services-in-pune window-cleaning-services-in-undri window-cleaning-services-in-hadapsar window-cleaning-services-in-mohammadwadi window-cleaning-services-in-kharadi window-cleaning-services-in-amanora-park
bathroom-cleaning-services-in-pune bathroom-cleaning-services-in-undri bathroom-cleaning-services-in-amanora-park bathroom-cleaning-services-in-mohammadwadi bathroom-cleaning-services-in-kharadi bathroom-cleaning-services-in-hadapsar
bungalows-cleaning-services-in-pune bungalows-cleaning-services-in-undri bungalows-cleaning-services-in-amanora-park bungalows-cleaning-services-in-mohammadwadi bungalows-cleaning-services-in-hadapsar bungalows-cleaning-services-in-kharadi
carpet-cleaning-services-in-kharadi carpet-cleaning-services-in-pune carpet-cleaning-services-in-undri carpet-cleaning-services-in-amanora-park carpet-cleaning-services-in-mohammadwadi carpet-cleaning-services-in-hadapsar
corporate-office-cleaning bathroom-cleaning-service sofa-cleaning-shampooing one-time-cleaning residential-apartment-cleaning window-cleaning steam-cleaning carpet-cleaning mattress-cleaning kitchen-cleaning house-deep-cleaning commercial-deep-cleaning chair-cleaning-residential-commercial intensive-deep-cleaning move-in-move-out-cleaning end-of-tenancy-cleaning deep-cleaning-services
interior-painting-services-pune post-construction-cleaning-pune pest-control-services-pune cleaning-services-baner-wakad cockroach-control-pune termite-treatment-pune bed-bug-treatment-pune painting-services-pune rental-painting-pune commercial-painting-pune rent-agreement-pune packers-and-movers-pune property-desk-pune
pest-control-services-in-wakad pest-control-services-in-baner pest-control-services-in-pcmc
`.split(/\s+/).filter(Boolean).map((s) => "/" + s);

// sahara-web /<segment>/<area> pages (31 areas).
const SAHARA_WEB_AREAS = ["balewadi","aundh","pashan","bavdhan","karve-nagar","wagholi","kalyani-nagar","yerwada","katraj","dhankawadi","kondhwa","fursungi","bibwewadi","ambegaon","pimple-nilakh","chinchwad","nigdi","camp","shivajinagar","hinjewadi","kothrud","viman-nagar","kharadi","hadapsar","magarpatta","mohammadwadi","nibm","undri","pimple-saudagar","baner","wakad"];

const bySource = new Map(LEGACY_REDIRECTS.map((r) => [r.source, r]));
const validDest = (d: string) => {
  if (NATIVE.has(d)) return true;
  if (d === "/sitemap.xml" || d === "/home-deep-cleaning-pune") return true; // live Next.js sitemap route + the Pune deep-cleaning landing page (200 on production 2026-11-12)
  const m = d.match(/^\/services\/([^/]+)(?:\/([^/]+))?$/);
  if (!m) return false;
  const [, svc, area] = m;
  if (!area && CATALOG_SERVICES.some((c) => c.slug === svc)) return true; // service catalog landing page (2026-11-02)
  return (SERVICE_SLUGS as readonly string[]).includes(svc) && (!area || (AREA_SLUGS as readonly string[]).includes(area));
};

test("every WordPress-era URL has a 301", () => {
  const missing = LEGACY_ONE_SEGMENT.filter((p) => !NATIVE.has(p) && !bySource.has(p));
  assert.deepEqual(missing, []);
});

test("every sahara-web /<service>/<area> URL has a 301", () => {
  const missing: string[] = [];
  for (const seg of Object.keys(SEGMENT_TO_SERVICE)) for (const a of SAHARA_WEB_AREAS) if (!bySource.has(`/${seg}/${a}`)) missing.push(`/${seg}/${a}`);
  assert.deepEqual(missing, []);
});

test("all destinations are real Sahara OS routes", () => {
  const bad = LEGACY_REDIRECTS.filter((r) => !validDest(r.destination)).map((r) => `${r.source} -> ${r.destination}`);
  assert.deepEqual(bad, []);
});

test("no loops, no duplicate sources, never shadows a native route, all 301", () => {
  const seen = new Set<string>();
  for (const r of LEGACY_REDIRECTS) {
    assert.notEqual(r.source, r.destination, r.source);
    assert.ok(!seen.has(r.source), `duplicate ${r.source}`);
    seen.add(r.source);
    assert.ok(!NATIVE.has(r.source), `shadows native route ${r.source}`);
    assert.equal(r.statusCode, 301);
    assert.ok(!bySource.has(r.destination), `chain: ${r.source} -> ${r.destination} is itself redirected`);
  }
});

test("spot checks", () => {
  assert.equal(bySource.get("/sofa-cleaning-services-in-pune")?.destination, "/services/sofa-carpet-mattress-cleaning");
  assert.equal(bySource.get("/mattress-steam-services-in-kharadi")?.destination, "/services/sofa-carpet-mattress-cleaning/kharadi");
  assert.equal(bySource.get("/cleaning-services-in-amanora-park")?.destination, "/services/home-deep-cleaning/hadapsar");
  assert.equal(bySource.get("/pest-control/karve-nagar")?.destination, "/services/pest-control/kothrud");
  assert.equal(bySource.get("/deep-cleaning/fursungi")?.destination, "/services/home-deep-cleaning/phursungi");
  assert.equal(bySource.get("/painting-services/nigdi")?.destination, "/services/interior-painting/pimpri");
  assert.equal(bySource.get("/about")?.destination, "/");
});

test("2026-11-12 GSC 404s: old WordPress .html pages, WP sitemap files and booking deep links 301 to live pages", () => {
  assert.equal(bySource.get("/index.html")?.destination, "/");
  assert.equal(bySource.get("/bathroom-cleaning-services-pune.html")?.destination, "/services/kitchen-bathroom-cleaning");
  assert.equal(bySource.get("/end-of-tenancy-cleaning-services-pune.html")?.destination, "/services/home-deep-cleaning");
  assert.equal(bySource.get("/sofa-cleaning-services-in-kharadi.html")?.destination, "/services/sofa-carpet-mattress-cleaning/kharadi");
  for (const f of ["/page-sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) assert.equal(bySource.get(f)?.destination, "/sitemap.xml", f);
  assert.equal(bySource.get("/home-deep-cleaning-pune/:path+")?.destination, "/home-deep-cleaning-pune");
});
