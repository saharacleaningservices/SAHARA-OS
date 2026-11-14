// Google Maps helpers for the field app. Pure (no server imports) so UI and tests can share them.
import { validCoords } from "./geo";

/** Pulls "lat,lng" out of the common Google Maps URL shapes (@lat,lng · q=lat,lng · ll= · !3d..!4d..). */
export function coordsFromMapLink(link?: string | null): { lat: number; lng: number } | null {
  if (!link) return null;
  const s = decodeURIComponent(link);
  const pats = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+)[, ]\s*(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/];
  for (const re of pats) {
    const m = re.exec(s);
    if (m) {
      const c = validCoords(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  return null;
}

const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u.trim());

/**
 * One-tap "Navigate via Google Maps" URL. Exact coordinates win, then the customer's shared map pin,
 * then the written address.
 */
export function googleMapsNavUrl(job: { address?: string | null; mapLink?: string | null; lat?: number | null; lng?: number | null }): string | null {
  const dir = (dest: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  const own = job.lat != null && job.lng != null ? validCoords(job.lat, job.lng) : null;
  const c = own ?? coordsFromMapLink(job.mapLink);
  if (c) return dir(`${c.lat},${c.lng}`);
  if (isHttp(job.mapLink)) return job.mapLink!.trim();
  const a = job.address?.trim();
  return a ? dir(a) : null;
}

/** Straight-line distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
