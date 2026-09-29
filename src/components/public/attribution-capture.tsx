"use client";

import { useEffect } from "react";
import type { AttributionPayload, Touch } from "@/lib/attribution";

// First-touch / latest-touch capture for the public pages. Stored in
// localStorage on booking.saharacleaningservices.com so /offers → /book keeps
// the same attribution. First touch is written once and never overwritten.

const FIRST = "sahara_attr_first";
const LATEST = "sahara_attr_latest";

function read(key: string): Touch | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Touch) : null;
  } catch {
    return null;
  }
}

function write(key: string, t: Touch) {
  try {
    window.localStorage.setItem(key, JSON.stringify(t));
  } catch {
    /* storage blocked — attribution just stays unknown */
  }
}

function currentTouch(): Touch {
  const p = new URLSearchParams(window.location.search);
  const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;
  return {
    source: p.get("utm_source"),
    medium: p.get("utm_medium"),
    campaign: p.get("utm_campaign"),
    term: p.get("utm_term"),
    content: p.get("utm_content"),
    gclid: p.get("gclid"),
    fbclid: p.get("fbclid"),
    referrer: ref,
    landingPage: window.location.pathname,
    landingPageUrl: window.location.href.slice(0, 1000),
    at: new Date().toISOString(),
  };
}

const hasSignal = (t: Touch) => Boolean(t.source || t.gclid || t.fbclid || t.referrer);

/** Records the visit. Render once on every public marketing page. */
export function AttributionCapture() {
  useEffect(() => {
    const now = currentTouch();
    if (!read(FIRST)) write(FIRST, now);
    // Latest touch only moves when this visit carries a real signal, so an
    // internal page reload doesn't wipe the campaign that brought them here.
    if (hasSignal(now) || !read(LATEST)) write(LATEST, now);
  }, []);
  return null;
}

/** Attribution to send with a form submission. */
export function getAttributionPayload(): AttributionPayload {
  if (typeof window === "undefined") return {};
  const first = read(FIRST);
  const latest = read(LATEST) ?? first;
  return { first, latest };
}
