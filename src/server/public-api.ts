import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyPublicApiRequest } from "@/lib/public-api-auth";
import { rateLimit } from "@/lib/rate-limit";

// Shared plumbing for the public REST API (src/app/api/public/v1/*, contract: docs/website/public-api-v1.openapi.yaml).

export type ApiErrorCode = "VALIDATION" | "THROTTLED" | "SLOT_FULL" | "PACKAGE_UNAVAILABLE" | "FESTIVAL_DATE_REQUIRED" | "UNAUTHORIZED" | "IDEMPOTENCY_MISMATCH" | "PAYLOAD_TOO_LARGE" | "UNAVAILABLE";

export const MAX_BODY_BYTES = 100_000;

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiError(status: number, error: string, code: ApiErrorCode, headers: Record<string, string> = {}) {
  return apiJson({ error, code }, status, headers);
}

/**
 * Authenticates a request. Returns a Response to send back (404 when the API is not configured, 401 on any auth
 * failure, 429 for the key-wide flood limit) or null when the request may proceed.
 */
export function guardPublicApi(req: NextRequest, rawBody: string): NextResponse | null {
  const auth = verifyPublicApiRequest({
    authorization: req.headers.get("authorization"),
    timestamp: req.headers.get("x-sahara-timestamp"),
    signature: req.headers.get("x-sahara-signature"),
    rawBody,
  });
  if (!auth.ok) {
    if (auth.status === 404) return new NextResponse(null, { status: 404 }); // inert: indistinguishable from "no such route"
    return apiError(401, "Unauthorized.", "UNAUTHORIZED");
  }
  // Whole-API flood limit on top of the per-visitor limits inside the booking logic (in-memory, single instance).
  if (!rateLimit("pubapi:all", 600, 60).allowed) return apiError(429, "Too many requests.", "THROTTLED", { "Retry-After": "30" });
  return null;
}

/** Map the booking logic's refusal to an HTTP status + code. The honeypot answers like any validation error (no hint to bots). */
export function bookingErrorResponse(res: { error: string; code?: string }) {
  switch (res.code) {
    case "THROTTLED":
      return apiError(429, res.error, "THROTTLED", { "Retry-After": "60" });
    case "SLOT_FULL":
    case "PACKAGE_UNAVAILABLE":
    case "FESTIVAL_DATE_REQUIRED":
      return apiError(409, res.error, res.code);
    default: // VALIDATION, HONEYPOT, and the quotation-link refusals
      return apiError(400, res.error, "VALIDATION");
  }
}

// ---- idempotency -------------------------------------------------------------------------------------------------
// A retried POST (lost response, mobile network) must never double-submit. Successful responses are remembered for 24 h by
// Idempotency-Key (in memory: single instance, like lib/rate-limit.ts). After a restart a retry simply runs again — safe,
// because the booking logic itself updates the open enquiry for the same mobile + service instead of creating a duplicate.
// Only successes are cached, so a throttled or invalid attempt can always be retried.
const TTL_MS = 24 * 3600_000;
const MAX_KEYS = 2000;
type Entry = { bodyHash: string; at: number; done?: { status: number; body: unknown }; pending?: Promise<{ status: number; body: unknown }> };
const store = new Map<string, Entry>();

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;

/** Test hook: forget everything. */
export function resetIdempotencyStore() {
  store.clear();
}

export async function withIdempotency(
  key: string,
  rawBody: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown; replayed: boolean }> {
  const now = Date.now();
  for (const [k, e] of store) if (now - e.at > TTL_MS) store.delete(k);
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const existing = store.get(key);
  if (existing) {
    if (existing.bodyHash !== bodyHash) return { status: 422, body: { error: "Idempotency-Key was already used with a different request.", code: "IDEMPOTENCY_MISMATCH" }, replayed: false };
    if (existing.done) return { ...existing.done, replayed: true };
    if (existing.pending) return { ...(await existing.pending), replayed: true }; // same request still in flight: share its result
  }
  const entry: Entry = { bodyHash, at: now };
  entry.pending = run();
  store.set(key, entry);
  if (store.size > MAX_KEYS) store.delete(store.keys().next().value as string); // oldest first
  try {
    const out = await entry.pending;
    if (out.status === 200) {
      entry.done = out;
      entry.pending = undefined;
    } else store.delete(key); // never pin an error
    return { ...out, replayed: false };
  } catch (e) {
    store.delete(key);
    throw e;
  }
}
