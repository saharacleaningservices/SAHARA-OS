"use client";

import { useEffect } from "react";
import type { AttributionPayload } from "@/lib/attribution";

// Silent tap-to-call logger (owner 2026-11-13). Any tap on a tel: link sends one tiny beacon to /api/leads/call-click, which
// logs a [CALL-CLICK] lead with the visitor's UTM source. It never blocks or delays the call itself, and one listener serves
// the whole page however many components ask for it. getPayload is attribution-capture's getAttributionPayload.

type Flagged = Window & { __saharaCallClickTracker?: boolean };
const DEDUPE_MS = 4000;

export function useCallClickTracker(getPayload: () => AttributionPayload) {
  useEffect(() => {
    const w = window as Flagged;
    if (w.__saharaCallClickTracker) return;
    w.__saharaCallClickTracker = true;
    let lastAt = 0;
    const onClick = (e: Event) => {
      try {
        const a = (e.target as Element | null)?.closest?.("a[href^='tel:' i]") as HTMLAnchorElement | null;
        if (!a) return;
        const now = Date.now();
        if (now - lastAt < DEDUPE_MS) return;
        lastAt = now;
        const body = JSON.stringify({ href: a.getAttribute("href"), page: window.location.pathname, attribution: getPayload() });
        const blob = new Blob([body], { type: "application/json" });
        if (!(navigator.sendBeacon && navigator.sendBeacon("/api/leads/call-click", blob))) {
          void fetch("/api/leads/call-click", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
        }
      } catch {
        /* tracking must never get in the way of the call */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      w.__saharaCallClickTracker = false;
    };
  }, [getPayload]);
}
