// Google Maps helpers shared by the client picker (MapsLocationInput) and
// the server. Pure functions — no key needed. The picker only needs the
// Google Maps API key for the interactive "Pin on Map" mode and the map
// preview; "Paste Maps Link" and "Use Current Location" work without one.

export type LatLng = { lat: number; lng: number };

const VALID = (n: number) => Number.isFinite(n) && Math.abs(n) <= 180;

/**
 * Pulls a lat/lng out of the common Google Maps URL shapes:
 *   .../@18.5204,73.8567,17z
 *   ...?q=18.5204,73.8567     ...?query=18.5204,73.8567
 *   ...!3d18.5204!4d73.8567
 *   ...&ll=18.5204,73.8567    ...&center=18.5204,73.8567
 *   .../place/18.5204,73.8567
 *   a bare "18.5204, 73.8567"
 * Short links (maps.app.goo.gl/…, goo.gl/maps/…) can't be expanded in the
 * browser — those are kept as-is and just opened/embedded as a link.
 */
export function parseMapLink(input: string | null | undefined): LatLng | null {
  if (!input) return null;
  const s = input.trim();

  const patterns: RegExp[] = [
    // Most precise first: the actual marker position in a Google place URL.
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|center|destination|sll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /\/place\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (VALID(lat) && VALID(lng) && Math.abs(lat) <= 90) return { lat, lng };
    }
  }
  return null;
}

/** Canonical Google Maps link for a coordinate — always openable, no key. */
export function buildMapLink({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Turn-by-turn navigation link (opens the Maps app on mobile). */
export function buildDirectionsLink({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * A multi-stop route link for the day's run. Stops that have parseable
 * coordinates use those; the rest fall back to their address text. Google
 * Maps builds the optimised-ish route between the stops in order.
 */
export function buildRouteLink(stops: { mapLink?: string | null; address?: string | null }[]): string | null {
  const parts = stops
    .map((s) => {
      const c = parseMapLink(s.mapLink);
      if (c) return `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
      return s.address ? s.address.replace(/\s+/g, " ").trim() : null;
    })
    .filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/dir/${parts.map((p) => encodeURIComponent(p)).join("/")}`;
}

/** Google Maps Embed API URL for an <iframe> preview (needs a key). */
export function buildEmbedUrl(coord: LatLng, apiKey: string): string {
  return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(
    apiKey
  )}&center=${coord.lat},${coord.lng}&zoom=16`;
}

export function looksLikeMapsUrl(s: string): boolean {
  return /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
    s.trim()
  );
}
