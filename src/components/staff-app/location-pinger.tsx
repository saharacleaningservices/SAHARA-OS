"use client";

import { useEffect } from "react";
import { recordLocationPing } from "@/server/actions/tracking";

const EVERY_MS = 3 * 60_000;

/**
 * Active-shift GPS ping while the app is open (a live job for technicians; any CRM page for Francis / Shoaib via the app layout). Browsers cannot read location in the background, so pings stop when the
 * app is closed. No UI and no way to pause it here: the switch lives with the Super Admin (server-side), and failures are silent.
 */
export function LocationPinger({ jobId }: { jobId: string | null }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (p) => void recordLocationPing(jobId, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }).catch(() => {}),
        () => {},
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      );
    };
    ping();
    const t = setInterval(ping, EVERY_MS);
    return () => clearInterval(t);
  }, [jobId]);
  return null;
}
