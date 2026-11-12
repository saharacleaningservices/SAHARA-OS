// Stateless mobile-OTP primitives for the website booking flow (owner 2026-11-12). No database table: a code is derived
// from HMAC(AUTH_SECRET, mobile + 5-minute window) and is accepted for the current and the previous window (5–10 min).
// A verified mobile is proven to later server calls by a short-lived signed token. Pure and unit-tested — the senders,
// rate limits and CRM lookups live in server/actions/booking-checkout.ts.

import { createHmac, timingSafeEqual } from "node:crypto";

export const OTP_WINDOW_MS = 5 * 60_000;
export const VERIFIED_TTL_MS = 45 * 60_000;

const keyOf = (key?: string | null) => {
  const k = key ?? process.env.AUTH_SECRET ?? "";
  return k.length >= 16 ? k : null;
};
const tail10 = (mobile: string) => mobile.replace(/\D/g, "").slice(-10);
const hmac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("hex");

export function otpCode(mobile: string, windowIndex: number, key?: string | null): string | null {
  const k = keyOf(key);
  if (!k) return null;
  return String(parseInt(hmac(k, `otp:${tail10(mobile)}:${windowIndex}`).slice(0, 8), 16) % 1_000_000).padStart(6, "0");
}

export const currentOtp = (mobile: string, now = Date.now(), key?: string | null) => otpCode(mobile, Math.floor(now / OTP_WINDOW_MS), key);

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** True when `code` is the code of the current or the previous window for this mobile. */
export function otpMatches(mobile: string, code: string, now = Date.now(), key?: string | null): boolean {
  const c = code.replace(/\D/g, "");
  if (c.length !== 6) return false;
  const w = Math.floor(now / OTP_WINDOW_MS);
  return [w, w - 1].some((i) => {
    const expected = otpCode(mobile, i, key);
    return expected != null && same(expected, c);
  });
}

/** Token proving this mobile passed OTP verification: `<expiryMs>.<signature>`. */
export function signVerified(mobile: string, now = Date.now(), key?: string | null): string | null {
  const k = keyOf(key);
  if (!k) return null;
  const exp = now + VERIFIED_TTL_MS;
  return `${exp}.${hmac(k, `ok:${tail10(mobile)}:${exp}`)}`;
}

export function verifyVerified(token: string | null | undefined, mobile: string, now = Date.now(), key?: string | null): boolean {
  const k = keyOf(key);
  if (!k || !token) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < now) return false;
  return same(hmac(k, `ok:${tail10(mobile)}:${exp}`), sig);
}
