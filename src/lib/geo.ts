// Free location capture for job check-in / check-out: the browser's own Geolocation API (no paid maps service).
// Capture never blocks a status change — if the device refuses, times out or has no GPS the job still moves on and the
// activity log simply says no location was captured.

export type GeoFix = { lat: number; lng: number; acc?: number };

/** Browser only. Resolves null on denial, timeout or no support — never rejects. */
export function getBrowserLocation(timeoutMs = 6000): Promise<GeoFix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Validates an untrusted fix coming from the client; returns null when it is not a plausible coordinate. */
export function cleanFix(v: unknown): GeoFix | null {
  if (!v || typeof v !== "object") return null;
  const { lat, lng, acc } = v as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, ...(typeof acc === "number" && Number.isFinite(acc) && acc >= 0 && acc < 100_000 ? { acc: Math.round(acc) } : {}) };
}

/** " · location 18.50863, 73.92985 (±25 m)" for the activity log, or " · location not captured". */
export function locationNote(fix: GeoFix | null): string {
  if (!fix) return " · location not captured";
  return ` · location ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${fix.acc != null ? ` (±${fix.acc} m)` : ""} · https://maps.google.com/?q=${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}`;
}
