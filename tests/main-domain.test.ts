// Main-domain-only cutover (owner 2026-11-01): apex is the one public origin; www.* and booking.* 301 to it.
// Runs the real middleware with BOOKING_URL = the apex. No network, no DB. Run: npx tsx --test tests/main-domain.test.ts
import test from "node:test";
import assert from "node:assert/strict";

process.env.BOOKING_URL = "https://saharacleaningservices.com";
process.env.CRM_URL = "https://crm.saharacleaningservices.com";
process.env.AUTH_SECRET = "unit-test-auth-secret-not-real-0123456789";

let middleware: typeof import("../src/middleware").middleware;
let NextRequest: typeof import("next/server").NextRequest;
test.before(async () => {
  middleware = (await import("../src/middleware")).middleware;
  NextRequest = (await import("next/server")).NextRequest;
});

const hit = (host: string, path: string) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
const loc = (r: Response) => r.headers.get("location");
const rewrite = (r: Response) => (r.headers.get("x-middleware-rewrite") ? new URL(r.headers.get("x-middleware-rewrite")!).pathname : null);

test("www.* and booking.* permanently forward to the apex, keeping path and query", async () => {
  for (const host of ["www.saharacleaningservices.com", "booking.saharacleaningservices.com"]) {
    const r = await hit(host, "/services/pest-control/baner?utm_source=gmb");
    assert.equal(r.status, 301, host);
    assert.equal(loc(r), "https://saharacleaningservices.com/services/pest-control/baner?utm_source=gmb");
    const root = await hit(host, "/");
    assert.equal(root.status, 301);
    assert.equal(loc(root), "https://saharacleaningservices.com/");
  }
});

test("webhooks and API calls on the old booking host are NOT redirected (Meta keeps its callback URL)", async () => {
  const r = await hit("booking.saharacleaningservices.com", "/api/webhooks/whatsapp");
  assert.equal(r.status, 200);
  assert.equal(loc(r), null);
});

test("apex serves the public site and 404s CRM paths", async () => {
  const home = await hit("saharacleaningservices.com", "/");
  assert.equal(loc(home), null);
  assert.equal(rewrite(home), null);
  for (const p of ["/booking", "/services/pest-control/baner", "/sitemap.xml", "/robots.txt"]) {
    const r = await hit("saharacleaningservices.com", p);
    assert.equal(loc(r), null, p);
    assert.equal(rewrite(r), null, p);
  }
  for (const p of ["/dashboard", "/login", "/leads"]) {
    const r = await hit("saharacleaningservices.com", p);
    assert.equal(loc(r), null, p);
    assert.equal(rewrite(r), "/__booking-not-found", p);
  }
});

test("crm.* still sends a signed-out visitor to login", async () => {
  const r = await hit("crm.saharacleaningservices.com", "/");
  assert.equal(new URL(loc(r)!).pathname, "/login");
});
