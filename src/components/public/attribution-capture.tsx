"use client";

import { useEffect } from "react";
import type { AttributionPayload, Touch } from "@/lib/attribution";
import { useWhatsAppRefTagger } from "@/components/public/whatsapp-ref-tagger";
import { useCallClickTracker } from "@/components/public/call-click-tracker";
import { ATTRIBUTION_TTL_SECONDS, cookieDomainFor, cookieValueFor, fbcFromFbclid, hasSignal, isTouchFresh, readCookie, touchFromCookieValue } from "@/lib/attribution-storage";

// First-touch / latest-touch capture for the public pages (owner 2026-11-12: 90-day click-to-lead window).
// Each touch is kept in localStorage AND in a first-party cookie (shared across saharacleaningservices.com and its subdomains),
// so /offers → /book and apex → booking.* keep the same attribution even if one store is cleared. A touch older than
// 90 days is dropped and re-captured. First touch is written once per window and never overwritten inside it.
// Meta's _fbp / _fbc cookies ride along on every touch (Event Match Quality).

const FIRST = "sahara_attr_first";
const LATEST = "sahara_attr_latest";

function readLocal(key: string): Touch | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Touch) : null;
  } catch {
    return null;
  }
}

/** The freshest usable copy of a touch from either store, or null when both are missing / past 90 days. */
function read(key: string): Touch | null {
  const local = readLocal(key);
  if (isTouchFresh(local)) return local;
  const fromCookie = touchFromCookieValue(readCookie(document.cookie, key));
  return isTouchFresh(fromCookie) ? fromCookie : null;
}

function write(key: string, t: Touch) {
  try {
    window.localStorage.setItem(key, JSON.stringify(t));
  } catch {
    /* storage blocked — the cookie copy still carries it */
  }
  try {
    const domain = cookieDomainFor(window.location.hostname);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${key}=${cookieValueFor(t)}; Max-Age=${ATTRIBUTION_TTL_SECONDS}; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${secure}`;
  } catch {
    /* cookies blocked — attribution just stays on localStorage */
  }
}

/** Meta's browser id and click id, from the Pixel's cookies (or rebuilt from ?fbclid= before the Pixel has written _fbc). */
function metaIds(fbclid?: string | null): { fbp: string | null; fbc: string | null } {
  const fbp = readCookie(document.cookie, "_fbp");
  const fbc = readCookie(document.cookie, "_fbc") ?? fbcFromFbclid(fbclid);
  return { fbp, fbc };
}

function currentTouch(): Touch {
  const p = new URLSearchParams(window.location.search);
  const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;
  const fbclid = p.get("fbclid");
  return {
    source: p.get("utm_source"),
    medium: p.get("utm_medium"),
    campaign: p.get("utm_campaign"),
    term: p.get("utm_term"),
    content: p.get("utm_content"),
    gclid: p.get("gclid"),
    fbclid,
    ...metaIds(fbclid),
    referrer: ref,
    landingPage: window.location.pathname,
    landingPageUrl: window.location.href.slice(0, 1000),
    at: new Date().toISOString(),
  };
}

/** Records the visit. Render once on every public marketing page. */
export function AttributionCapture() {
  useWhatsAppRefTagger(getAttributionPayload); // WhatsApp buttons carry "[Ref: …]" for the lead source (lib/source-label.ts)
  useCallClickTracker(getAttributionPayload); // tel: taps log a [CALL-CLICK] lead (owner 2026-11-13)
  useEffect(() => {
    const now = currentTouch();
    if (!read(FIRST)) write(FIRST, now);
    // Latest touch only moves when this visit carries a real signal, so an
    // internal page reload doesn't wipe the campaign that brought them here.
    if (hasSignal(now) || !read(LATEST)) write(LATEST, now);
  }, []);
  return null;
}

/** A stored touch plus whatever Meta ids exist right now (the Pixel may have written _fbp after the first page view). */
function withMetaIds(t: Touch | null): Touch | null {
  if (!t) return t;
  if (t.fbp && t.fbc) return t;
  const ids = metaIds(t.fbclid);
  return { ...t, fbp: t.fbp ?? ids.fbp, fbc: t.fbc ?? ids.fbc };
}

/** Attribution to send with a form submission. */
export function getAttributionPayload(): AttributionPayload {
  if (typeof window === "undefined") return {};
  const first = withMetaIds(read(FIRST));
  const latest = withMetaIds(read(LATEST) ?? first);
  return { first, latest };
}

/** Current Meta browser / click ids for server-side (Conversions API) matching; both null when the Pixel has not set them. */
export function getMetaIds(): { fbp: string | null; fbc: string | null } {
  if (typeof window === "undefined") return { fbp: null, fbc: null };
  const a = getAttributionPayload();
  const t = a.latest ?? a.first;
  const ids = metaIds(t?.fbclid);
  return { fbp: ids.fbp ?? t?.fbp ?? null, fbc: ids.fbc ?? t?.fbc ?? null };
}
