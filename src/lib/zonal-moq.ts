// Dynamic zonal minimum order value (owner Phase 2 directive, 2026-11-02 — revised). Pure, unit-tested in tests/phase2-2026-11-02.test.ts.
//
//   ZONE A — no minimum: Magarpatta, Hadapsar, Kharadi, Undri, NIBM, Wanowrie, Mohammadwadi, Phursungi, Handewadi, Viman Nagar,
//            Camp, Kalyani Nagar, Koregaon Park, Kondhwa, Dhankawadi, Balaji Nagar — small single services (₹300 window,
//            ₹599 bathroom) book freely.
//   ZONE B — ₹3,999 minimum ONLY for West Pune (Hinjewadi, Baner, Balewadi, Wakad, Pashan, Sus, Sutarwadi, Aundh, Bavdhan),
//            Central/South-West (Kothrud, Warje, Sinhagad Road, Narhe) and PCMC (Pimpri, Chinchwad, Nigdi, Bhosari, Pimple
//            Saudagar, Pimple Nilakh…). Every pune-seo-matrix locality in the "west-pcmc" zone counts as Zone B.
//   Any other area → no minimum (the restriction applies only where listed).
// Pest control is excluded (priced per home size). Final sprint 2026-11-02: the rule gates every non-pest priced basket below
// ₹3,999 (individual services, combos, 1/2 BHK unfurnished) in the booking modal AND on the server (public-booking-core.ts).

export const MOQ_VALUE = 3999;
export const NEARBY_RADIUS_KM = 7;

/** Zone A — pune-seo-matrix slugs plus picker-only areas (see EXTRA_AREAS). */
export const NO_MOQ_LOCALITIES = ["magarpatta", "hadapsar", "kharadi", "undri", "nibm", "wanowrie", "mohammadwadi", "phursungi", "handewadi", "viman-nagar", "camp", "kalyani-nagar", "koregaon-park", "kondhwa", "dhankawadi", "balaji-nagar"] as const;

/** Zone B — explicit slugs; any matrix locality in the west-pcmc zone is Zone B too (WEST_PCMC_SLUGS, passed by the caller). */
export const MOQ_LOCALITIES = ["hinjewadi", "baner", "balewadi", "wakad", "pashan", "sus", "sutarwadi", "aundh", "bavdhan", "kothrud", "warje", "sinhagad-road", "narhe", "pimpri", "chinchwad", "nigdi", "bhosari", "pimple-saudagar", "pimple-nilakh"] as const;

/** Areas customers ask for that have no SEO page of their own, offered in the booking area picker. */
export const EXTRA_AREAS = [
  { slug: "handewadi", name: "Handewadi", group: "East Pune" },
  { slug: "warje", name: "Warje", group: "South & Central Pune" },
  { slug: "sinhagad-road", name: "Sinhagad Road", group: "South & Central Pune" },
  { slug: "narhe", name: "Narhe", group: "South & Central Pune" },
  { slug: "nigdi", name: "Nigdi", group: "West Pune & PCMC" },
] as const;

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

/**
 * Zone B PIN codes (owner final sprint 2026-11-02): Hinjewadi/Wakad 411057, Baner/Balewadi 411045, Aundh 411007, Kothrud 411038,
 * Warje 411058, Narhe/Sinhagad Road 411041, Chinchwad 411019, Thergaon/Chinchwad 411033 — plus the remaining West Pune & PCMC
 * localities already in Zone B (Pimpri 411018, Pimple Saudagar/Nilakh 411027, Bhosari 411039, Nigdi 411044, Bavdhan/Sus/Pashan
 * 411021, Pashan 411008). Used for the check only — never printed on the website.
 */
export const ZONE_B_PINCODES = ["411057", "411045", "411007", "411038", "411058", "411041", "411019", "411033", "411018", "411027", "411039", "411044", "411021", "411008"] as const;

/** Exact customer-facing alert (owner wording). */
export const ZONE_B_MOV_MESSAGE = "Zone B (West Pune/PCMC) requires a Minimum Order Value of ₹3,999.";

export const normalizePincode = (v?: string | null) => (v ?? "").replace(/\D/g, "").slice(0, 6);
export const isZoneBPincode = (v?: string | null) => (ZONE_B_PINCODES as readonly string[]).includes(normalizePincode(v));
/** Locality name or slug → slug ("Sinhagad Road" → "sinhagad-road"). */
export const localitySlug = (v?: string | null) => (v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type MoqDecision = { moq: number; reason: "zone-a" | "nearby-gps" | "zone-b" | "zone-b-pincode" | "unrestricted-area" | "no-area" };

/** Minimum order for a booking location: ₹3,999 only for Zone B; Zone A, a GPS fix near a branch, or any other area → none. */
export function moqFor(input: { locality?: string | null; pincode?: string | null; gps?: { lat: number; lng: number } | null }, westPcmcSlugs: readonly string[] = []): MoqDecision {
  // A Zone B PIN code always wins — it is the most precise signal the customer gives us.
  if (isZoneBPincode(input.pincode)) return { moq: MOQ_VALUE, reason: "zone-b-pincode" };
  const slug = localitySlug(input.locality);
  if (slug && (NO_MOQ_LOCALITIES as readonly string[]).includes(slug)) return { moq: 0, reason: "zone-a" };
  if (slug && ((MOQ_LOCALITIES as readonly string[]).includes(slug) || westPcmcSlugs.includes(slug))) return { moq: MOQ_VALUE, reason: "zone-b" };
  if (input.gps && BRANCH_POINTS.some((b) => distanceKm(input.gps!, b) <= NEARBY_RADIUS_KM)) return { moq: 0, reason: "nearby-gps" };
  if (!slug) return { moq: 0, reason: "no-area" };
  return { moq: 0, reason: "unrestricted-area" };
}

/** Checkout drawer add-on chips, in display order: Fridge · Chimney · Pest Control Shot · Balcony. */
export const CHECKOUT_CHIP_IDS = ["SCS-32", "SCS-35", "SCS-36", "SCS-34"] as const;

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

/** Server-side gate: the total a Zone B booking must reach, or 0. Pest control is never gated. */
export function minimumOrderFor(input: { serviceCategory?: string | null; pincode?: string | null; locality?: string | null }, westPcmcSlugs: readonly string[] = []): number {
  if (input.serviceCategory === "PEST_CONTROL") return 0;
  const slug = localitySlug(input.locality);
  if (isZoneBPincode(input.pincode)) return MOQ_VALUE;
  if (slug && ((MOQ_LOCALITIES as readonly string[]).includes(slug) || westPcmcSlugs.includes(slug))) return MOQ_VALUE;
  return 0;
}

/** Fewest add-ons (largest first) that close the gap — the 1-click "Upgrade to ₹3,999" button. */
export function upgradeBundle(gap: number, pool: AddOn[], already: string[] = []): AddOn[] {
  if (gap <= 0) return [];
  const free = pool.filter((p) => !already.includes(p.contentId) && p.price > 0);
  const total = (p: AddOn) => p.price * Math.max(1, p.minQty);
  const single = free.filter((p) => total(p) >= gap).sort((a, b) => total(a) - total(b))[0];
  if (single) return [single];
  const out: AddOn[] = [];
  let left = gap;
  for (const p of [...free].sort((a, b) => total(b) - total(a))) {
    if (left <= 0) break;
    out.push(p);
    left -= total(p);
  }
  return left <= 0 ? out : [];
}
