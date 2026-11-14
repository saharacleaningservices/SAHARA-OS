"use client";

import { useEffect } from "react";
import { getLocationPingStatus, recordLocationPing } from "@/server/actions/tracking";

// Keep in step with PING_EVERY_MS in src/lib/field-ops.ts (not imported: that module uses node:crypto and is server-only).
const PING_EVERY_MS = 3 * 60_000;

/**
 * Continuous active-shift GPS ping while the app is open (owner 2026-11-14). Mounted once per app shell — the Staff App layout for
 * technicians, the CRM layout for Francis / Shoaib — so it keeps running across every page of the shift instead of only on one job page.
 *
 * Every PING_EVERY_MS it asks the server whether this person is on an active job (On the way → Reached → In progress, until Completed)
 * or checked in for the shift; only then does it read the GPS and send one fix (the server picks the live job and rate-limits).
 * It also pings at once when the app comes back to the foreground, so a phone that was locked does not wait a full interval.
 * Browsers cannot read location while the app is closed or fully backgrounded — that gap is unavoidable on the web.
 * No UI and no way to pause it here: the switch lives with the Super Admin (server-side), and failures are silent.
 */
export function LocationPinger({ jobId = null }: { jobId?: string | null }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let busy = false;
    let cancelled = false;
    const ping = async () => {
      if (busy || cancelled || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const { active } = await getLocationPingStatus();
        if (!active || cancelled) return;
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              void recordLocationPing(jobId, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }).catch(() => {});
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
          );
        });
      } catch {
        /* offline / server busy — try again next tick */
      } finally {
        busy = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    void ping();
    const t = setInterval(() => void ping(), PING_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [jobId]);
  return null;
}
