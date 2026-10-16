// Domain split: booking.* serves only the public booking surface (src/middleware.ts).
// Runs the real middleware with test hostnames — no network, no DB. Run: npm run test:domains
import test from "node:test";
import assert from "node:assert/strict";

process.env.BOOKING_URL = "https://booking.example.test";
process.env.CRM_URL = "https://crm.example.test";
process.env.AUTH_SECRET = "unit-test-auth-secret-not-real-0123456789";

let middleware: typeof import("../src/middleware").middleware;
let NextRequest: typeof import("next/server").NextRequest;
test.before(async () => {
  middleware = (await import("../src/middleware")).middleware;
  NextRequest = (await import("next/server")).NextRequest;
});

// Real traffic always carries a Host header (the middleware reads it, as behind the Coolify proxy).
const hit = (host: string, path: string) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
const location = (r: Response) => (r.headers.get("location") ? new URL(r.headers.get("location")!).pathname : null);

test("booking.*: home page goes straight to /booking in ONE redirect (not / → /book → /booking)", async () => {
  const r = await hit("booking.example.test", "/");
  assert.ok([307, 308].includes(r.status));
  assert.equal(location(r), "/booking");
});

test("booking.*: CRM and unknown paths never render there — redirected to /booking", async () => {
  for (const p of ["/dashboard", "/login", "/leads", "/settings", "/my", "/this-page-does-not-exist"]) {
    const r = await hit("booking.example.test", p);
    assert.equal(location(r), "/booking", p);
  }
});

test("booking.*: public pages, robots and sitemap are served (no redirect)", async () => {
  for (const p of ["/booking", "/home-deep-cleaning-pune", "/landing/home-deep-cleaning-pune", "/offers", "/robots.txt", "/sitemap.xml", "/privacy-policy"]) {
    const r = await hit("booking.example.test", p);
    assert.equal(location(r), null, `${p} should not redirect`);
  }
});

test("crm.* is not affected by the booking-host rule (dashboard → login when signed out)", async () => {
  const r = await hit("crm.example.test", "/dashboard");
  assert.equal(location(r), "/login");
});
