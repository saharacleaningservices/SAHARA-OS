// Dynamic zonal minimum order value (owner Phase 2 directive, 2026-11-02). Pure — unit-tested in tests/phase2-2026-11-02.test.ts.
//
// Logistics rule: crews start from Magarpatta City and Mohammadwadi, so small single-service jobs only pay off nearby.
//   East & nearby Pune (the localities below, or a GPS fix within NEARBY_RADIUS_KM of either branch) → no minimum order.
//   Everywhere else — West & Central Pune (Hinjewadi, Wakad, Baner, Balewadi, Pashan, Kothrud, Warje, Aundh…), PCMC,
//   North Pune, or an area the customer has not picked yet → ₹3,999 minimum order for individual services / combos.
// Full-home packages already start above the minimum, and pest control is priced per home size, so the rule only gates
// the INDIVIDUAL_CLEANING basket. Change the lists or the value here.

export const MOQ_VALUE = 3999;
export const NEARBY_RADIUS_KM = 7;

/** pune-seo-matrix locality slugs with no minimum order. */
export const NO_MOQ_LOCALITIES = ["magarpatta", "hadapsar", "kharadi", "undri", "nibm", "mohammadwadi", "phursungi"] as const;

/** Branch coordinates (Magarpatta: GBP listing in marketing-content; Mohammadwadi: BRANCHES.mohammadwadi.geo). */
export const BRANCH_POINTS = [
  { name: "Magarpatta", lat: 18.5082466, lng: 73.9298453 },
  { name: "Mohammadwadi", lat: 18.4754638, lng: 73.924633 },
] as const;

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type MoqDecision = { moq: number; reason: "nearby-locality" | "nearby-gps" | "outside-zone" | "no-area" };

/** Minimum order for a booking location. A locality on the no-MOQ list or a GPS fix near a branch waives it. */
export function moqFor(input: { locality?: string | null; gps?: { lat: number; lng: number } | null }): MoqDecision {
  const slug = (input.locality ?? "").trim().toLowerCase();
  if (slug && (NO_MOQ_LOCALITIES as readonly string[]).includes(slug)) return { moq: 0, reason: "nearby-locality" };
  if (input.gps && BRANCH_POINTS.some((b) => distanceKm(input.gps!, b) <= NEARBY_RADIUS_KM)) return { moq: 0, reason: "nearby-gps" };
  if (!slug && !input.gps) return { moq: MOQ_VALUE, reason: "no-area" };
  return { moq: MOQ_VALUE, reason: "outside-zone" };
}

export type AddOn = { contentId: string; name: string; price: number; minQty: number };

/**
 * 1-tap add-on suggestions to reach the minimum: the cheapest single add-on that closes the gap first, then the next best
 * fillers by price. `already` excludes items in the basket.
 */
export function suggestAddOns(gap: number, pool: AddOn[], already: string[] = [], max = 4): AddOn[] {
  if (gap <= 0) return [];
  const free = pool.filter((p) => !already.includes(p.contentId) && p.price > 0);
  const total = (p: AddOn) => p.price * Math.max(1, p.minQty);
  const closers = free.filter((p) => total(p) >= gap).sort((a, b) => total(a) - total(b));
  const fillers = free.filter((p) => total(p) < gap).sort((a, b) => total(b) - total(a));
  return [...closers, ...fillers].slice(0, max);
}
