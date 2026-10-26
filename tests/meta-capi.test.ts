// Meta Conversions API: hashing, payload shape, no-op without config, shared event id. Run: npm run test:capi
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildCapiPayload, normalizeEmail, normalizePhone, sendCapiEvent } from "../src/lib/meta-capi";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

test("phone is normalised to 91XXXXXXXXXX and hashed; junk is dropped", () => {
  assert.equal(normalizePhone("98765 43210"), "919876543210");
  assert.equal(normalizePhone("+91 98765-43210"), "919876543210");
  assert.equal(normalizePhone("12345"), undefined);
  assert.equal(normalizePhone("5876543210"), undefined, "must start 6-9");
  assert.equal(normalizeEmail("  Test@Example.COM "), "test@example.com");
  assert.equal(normalizeEmail("nope"), undefined);
});

test("payload carries event_id, hashed identifiers and never the raw phone/email", () => {
  const p = buildCapiPayload({
    eventName: "Lead", eventId: "evt-12345678", sourceUrl: "https://booking.saharacleaningservices.com/booking",
    mobile: "9876543210", email: "A@B.com", fbp: "fb.1.1.1", ip: "1.2.3.4", userAgent: "UA", category: "PEST", variant: "Termite", now: 1_700_000_000_000,
  });
  const e = p.data[0];
  assert.equal(e.event_name, "Lead");
  assert.equal(e.event_id, "evt-12345678");
  assert.equal(e.event_time, 1_700_000_000);
  assert.equal(e.action_source, "website");
  assert.deepEqual((e.user_data as { ph: string[] }).ph, [sha("919876543210")]);
  assert.deepEqual((e.user_data as { em: string[] }).em, [sha("a@b.com")]);
  const json = JSON.stringify(p);
  assert.ok(!json.includes("9876543210") && !json.includes("a@b.com"), "no raw PII in payload");
  assert.ok(!("test_event_code" in p));
  assert.equal(buildCapiPayload({ eventName: "Lead", eventId: "evt-12345678", sourceUrl: "x" }, "TEST123").test_event_code, "TEST123");
});

test("sendCapiEvent is a no-op (no network) while pixel id or token is unset", async () => {
  const keep = { p: process.env.NEXT_PUBLIC_META_PIXEL_ID, t: process.env.META_CAPI_TOKEN };
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.META_CAPI_TOKEN;
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => { called++; return new Response("{}"); }) as typeof fetch;
  try {
    const r = await sendCapiEvent({ eventName: "Lead", eventId: "evt-12345678", sourceUrl: "x" });
    assert.deepEqual(r, { sent: false, reason: "not-configured" });
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = realFetch;
    if (keep.p) process.env.NEXT_PUBLIC_META_PIXEL_ID = keep.p;
    if (keep.t) process.env.META_CAPI_TOKEN = keep.t;
  }
});

test("token goes in the Authorization header, not the URL", async () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "111";
  process.env.META_CAPI_TOKEN = "secret-token";
  const realFetch = globalThis.fetch;
  let seen: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response("{}", { status: 200 }); }) as typeof fetch;
  try {
    const r = await sendCapiEvent({ eventName: "Lead", eventId: "evt-12345678", sourceUrl: "x" });
    assert.equal(r.sent, true);
    assert.ok(seen && !seen.url.includes("secret-token") && seen.url.includes("/111/events"));
    assert.equal((seen!.init!.headers as Record<string, string>).Authorization, "Bearer secret-token");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.META_CAPI_TOKEN;
  }
});

test("trackLead gives the Pixel and the server the same event id", async () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "111";
  const calls: unknown[][] = [];
  const bodies: string[] = [];
  const g = globalThis as unknown as { window: unknown };
  g.window = { fbq: (...a: unknown[]) => calls.push(a), location: { href: "https://booking.saharacleaningservices.com/booking" } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => { bodies.push(String(init?.body)); return new Response("{}"); }) as typeof fetch;
  try {
    // PIXEL is read at import time, so import fresh after setting the env var
    const mod = await import("../src/components/public/marketing-tags?capi=1");
    mod.trackLead({ category: "PEST", variant: "Termite", mobile: "9876543210" });
    const lead = calls.find((c) => c[0] === "track" && c[1] === "Lead")!;
    const pixelId = (lead[3] as { eventID: string }).eventID;
    assert.ok(pixelId && pixelId.length >= 8);
    assert.equal(bodies.length, 1);
    assert.equal(JSON.parse(bodies[0]).eventId, pixelId, "same event id on both sides");
  } finally {
    globalThis.fetch = realFetch;
    delete (g as { window?: unknown }).window;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  }
});

test("route is reachable on the booking host and the token is never NEXT_PUBLIC", () => {
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.ok(mw.includes('"/api/meta/capi"'));
  const env = readFileSync(".env.example", "utf8");
  assert.ok(env.includes("META_CAPI_TOKEN=") && !env.includes("NEXT_PUBLIC_META_CAPI"));
});

test("protected numbers are matched across formats", async () => {
  const { isProtectedNumber } = await import("../src/lib/protected-numbers");
  for (const n of ["9921215250", "99212 15250", "+91 99212-15250", "919921215250", "09921215250", " 91-9168337130 ", "7083347130", "+917083347130", "9175220270"]) {
    assert.equal(isProtectedNumber(n), true, n);
  }
  for (const n of ["9800817070", "9876543210", "", undefined, null, "12345"]) assert.equal(isProtectedNumber(n as string), false, String(n));
});

test("protected number: no Pixel, no GA4, no Ads conversion, no server relay (browser) and no Meta call (server)", async () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "111";
  process.env.META_CAPI_TOKEN = "t";
  const calls: unknown[][] = [];
  const g = globalThis as unknown as { window: unknown };
  g.window = { fbq: (...a: unknown[]) => calls.push(["fbq", ...a]), gtag: (...a: unknown[]) => calls.push(["gtag", ...a]), location: { href: "https://booking.saharacleaningservices.com/booking" } };
  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async () => { fetches++; return new Response("{}"); }) as typeof fetch;
  try {
    const mod = await import("../src/components/public/marketing-tags?protected=1");
    mod.trackLead({ category: "X", variant: "Y", mobile: "+91 99212-15250" });
    mod.trackSchedule({ category: "X", mobile: "9921215250" });
    assert.equal(calls.length, 0, "no fbq/gtag calls");
    assert.equal(fetches, 0, "no relay call");
    const r = await sendCapiEvent({ eventName: "Lead", eventId: "evt-12345678", sourceUrl: "x", mobile: "09168337130" });
    assert.deepEqual(r, { sent: false, reason: "protected" });
    assert.equal(fetches, 0, "no Meta call");
  } finally {
    globalThis.fetch = realFetch;
    delete (g as { window?: unknown }).window;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.META_CAPI_TOKEN;
  }
});

test("route refuses requests without a valid mobile and has a fixed event allow-list", () => {
  const src = readFileSync("src/app/api/meta/capi/route.ts", "utf8");
  assert.ok(src.includes("normalizePhone(parsed.data.mobile)"));
  assert.ok(src.includes("z.enum(CAPI_EVENTS)"));
  assert.ok(!/accessToken|META_CAPI_TOKEN/.test(src), "route never touches the token");
});
