"use client";

export type GeoFix = { lat: number; lng: number; accuracy: number | null };

/** One-shot browser position. Resolves null (never rejects) on denial/timeout/unsupported. */
export function getPosition(timeoutMs = 8000): Promise<GeoFix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15_000 }
    );
  });
}
