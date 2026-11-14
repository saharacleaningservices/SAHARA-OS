"use client";

import { useEffect, useRef } from "react";
import { getPosition } from "@/lib/client-geo";

const PING_INTERVAL_MS = 60_000;

/**
 * Invisible: while `active` (checked in, not checked out) and the page is
 * visible, sends the device position to /api/staff/location-ping once a
 * minute. Browsers suspend timers in background tabs, so this is
 * foreground tracking — true background tracking needs a native app.
 */
export function LocationPinger({ active, jobId }: { active: boolean; jobId?: string }) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function ping() {
      if (cancelled || document.visibilityState !== "visible") return;
      if (Date.now() - lastSent.current < PING_INTERVAL_MS - 5_000) return;
      const fix = await getPosition(10_000);
      if (!fix || cancelled) return;
      lastSent.current = Date.now();
      await fetch("/api/staff/location-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, jobId: jobId ?? null }),
      }).catch(() => {});
    }

    void ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [active, jobId]);

  return null;
}
