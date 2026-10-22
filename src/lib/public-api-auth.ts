import { createHmac, timingSafeEqual } from "node:crypto";

// Request authentication for the public REST API used by the separate marketing website
// (docs/website/public-api-v1.openapi.yaml). Server-to-server only: the website's server signs each request.
//   Authorization: Bearer <PUBLIC_API_TOKEN>
//   X-Sahara-Timestamp: <unix seconds>            must be within ±5 minutes (limits replay)
//   X-Sahara-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with PUBLIC_API_HMAC_SECRET>
// Same scheme as the existing /api/webhook/email-lead route. Pure functions — no I/O — so they are unit-tested.
//
// INERT BY DEFAULT: unless BOTH variables are set (and at least MIN_SECRET_LENGTH long) the API answers 404 as if the
// routes did not exist. The owner enters both values in Coolify; they are never stored in code, docs or chat.

export const SIGNATURE_MAX_AGE_SECONDS = 300;
export const MIN_SECRET_LENGTH = 24;

export type PublicApiAuth = { ok: true } | { ok: false; status: 404 | 401 };

type Env = Record<string, string | undefined>;

/** True only when the owner has configured both secrets with a sensible length. */
export function publicApiConfigured(env: Env = process.env): boolean {
  const t = env.PUBLIC_API_TOKEN;
  const s = env.PUBLIC_API_HMAC_SECRET;
  return !!t && !!s && t.length >= MIN_SECRET_LENGTH && s.length >= MIN_SECRET_LENGTH;
}

/** Constant-time string comparison (no early exit on the first differing byte). */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The signature a client must send for this timestamp and raw body. Exported for the website client and tests. */
export function signPublicApiRequest(secret: string, timestamp: string, rawBody: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyPublicApiRequest(
  input: { authorization: string | null; timestamp: string | null; signature: string | null; rawBody: string },
  env: Env = process.env,
  nowMs: number = Date.now(),
): PublicApiAuth {
  if (!publicApiConfigured(env)) return { ok: false, status: 404 };
  const bearer = /^Bearer (.+)$/.exec(input.authorization ?? "")?.[1] ?? "";
  // Every failure below answers the same 401 so a caller cannot tell which check failed.
  if (!bearer || !safeEqual(bearer, env.PUBLIC_API_TOKEN as string)) return { ok: false, status: 401 };
  const ts = input.timestamp ?? "";
  if (!/^\d{9,11}$/.test(ts)) return { ok: false, status: 401 };
  if (Math.abs(nowMs / 1000 - Number(ts)) > SIGNATURE_MAX_AGE_SECONDS) return { ok: false, status: 401 };
  const expected = signPublicApiRequest(env.PUBLIC_API_HMAC_SECRET as string, ts, input.rawBody);
  if (!input.signature || !safeEqual(input.signature, expected)) return { ok: false, status: 401 };
  return { ok: true };
}
