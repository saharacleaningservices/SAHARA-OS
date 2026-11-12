// Pure helpers for the 90-day first-party attribution store (owner 2026-11-12). Used by
// components/public/attribution-capture.tsx; kept free of DOM access so they are unit-tested.
import type { Touch } from "@/lib/attribution";

/** Click-to-lead window we keep UTMs / gclid / fbclid for. */
export const ATTRIBUTION_TTL_DAYS = 90;
export const ATTRIBUTION_TTL_MS = ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000;
export const ATTRIBUTION_TTL_SECONDS = ATTRIBUTION_TTL_DAYS * 24 * 60 * 60;

/** A stored touch is usable for 90 days from the moment it was recorded. A touch with no timestamp cannot be aged, so it is dropped. */
export function isTouchFresh(t: Touch | null | undefined, now = Date.now()): boolean {
  if (!t?.at) return false;
  const at = Date.parse(t.at);
  if (Number.isNaN(at)) return false;
  return now - at < ATTRIBUTION_TTL_MS && at - now < 24 * 60 * 60 * 1000;
}

/** Meta's click-id cookie, rebuilt from ?fbclid= when the Pixel has not written _fbc yet: fb.<domainIndex>.<ms>.<fbclid>. */
export function fbcFromFbclid(fbclid: string | null | undefined, now = Date.now()): string | null {
  const id = (fbclid ?? "").trim();
  return /^[A-Za-z0-9_-]{6,380}$/.test(id) ? `fb.1.${now}.${id}` : null;
}

/** Reads one cookie out of a document.cookie string. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Cookie domain that is shared by the apex and its subdomains, or null (host-only cookie) for localhost / IPs / other hosts. */
export function cookieDomainFor(hostname: string): string | null {
  const h = hostname.toLowerCase();
  return h === "saharacleaningservices.com" || h.endsWith(".saharacleaningservices.com") ? ".saharacleaningservices.com" : null;
}

/** Cookies cap at ~4 KB, so the cookie copy keeps the fields that matter for attribution and drops the long URL / referrer. */
export function compactTouch(t: Touch): Touch {
  return {
    source: t.source ?? null,
    medium: t.medium ?? null,
    campaign: t.campaign ?? null,
    term: t.term ?? null,
    content: t.content ?? null,
    gclid: t.gclid ?? null,
    fbclid: t.fbclid ?? null,
    fbp: t.fbp ?? null,
    fbc: t.fbc ?? null,
    referrer: t.referrer ? t.referrer.slice(0, 120) : null,
    landingPage: t.landingPage ?? null,
    at: t.at ?? null,
  };
}

/** Serialises a touch for a Set-Cookie style write (without the cookie name). */
export function cookieValueFor(t: Touch): string {
  return encodeURIComponent(JSON.stringify(compactTouch(t)));
}

/** Parses a cookie value written by cookieValueFor; null when missing or malformed. */
export function touchFromCookieValue(raw: string | null): Touch | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Touch) : null;
  } catch {
    return null;
  }
}

/** Does this visit carry a real marketing signal (so it may replace the latest touch)? */
export const hasSignal = (t: Touch) => Boolean(t.source || t.gclid || t.fbclid || t.referrer);
