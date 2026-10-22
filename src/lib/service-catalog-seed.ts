// Service Catalog defaults (owner 2026-10-22): scope of work, terms & conditions and equipment for every major service.
//
// Where Sahara already has approved wording (the Premium/Platinum home scope, the customised-service scopes, the booking
// terms) it is reused verbatim, so the catalog can never disagree with the booking page. Everything else is ORIGINAL draft
// wording written for Sahara — it promises no results, timings or warranties — and is seeded with `reviewed: false` so the
// owner sees which entries still need a read-through before they are relied on. No prices live here (pricing master only).
import { BOOKING_TERMS } from "@/lib/pricing-master";
import { CUSTOMER_REQUIREMENTS, SMALL_SERVICE_SCOPE, homePleaseNote, homeScopeByArea, type HomeTier } from "@/lib/service-scope";

export type CatalogGroup = "HOME" | "COMMERCIAL" | "PEST_CONTROL" | "PAINTING";
export type CatalogSeed = {
  slug: string;
  name: string;
  group: CatalogGroup;
  scopeOfWork: string[];
  termsConditions: string[];
  equipmentsUsed: string[];
};

/** Clauses that apply to every service document (quotation, owner brief 2026-10-22). */
export const POST_INTERIOR_DISCLAIMER =
  "After interior work (painting, carpentry, tiling or polishing), dried paint, glue, adhesive, putty or cement marks on glass, tiles, wood or metal may not be fully removable. Our team makes a best effort without damaging the surface; complete removal is not guaranteed.";
export const VALUABLES_CLAUSE =
  "Please keep cash, jewellery and other valuables locked under key before the team starts. Sahara Cleaning Services is not responsible for items left unsecured.";
export const HIGH_RISE_CLAUSE =
  "For high-rise homes and offices, our team cleans windows and glass only from safe, reachable positions inside the premises or a secure balcony. Exterior glass beyond safe reach is excluded, and no work is done at height where safety arrangements are not available.";
export const COMMON_TERMS: string[] = [...BOOKING_TERMS, VALUABLES_CLAUSE, HIGH_RISE_CLAUSE, POST_INTERIOR_DISCLAIMER];

const HOME_EQUIPMENT = [
  "Industrial wet-and-dry vacuum cleaner",
  "Floor scrubbing and mopping kit",
  "Microfibre cloths, brushes and scrapers",
  "Surface-appropriate cleaning chemicals",
  "Glass-cleaning squeegee set",
  "Step ladders for reachable heights",
];

const homeScope = (tier: HomeTier) => homeScopeByArea(tier).flatMap((a) => a.items.map((i) => `${a.area} — ${i.item}: ${i.method}`));

const small = (id: string) => {
  const s = SMALL_SERVICE_SCOPE[id];
  return s ? { scope: s.includes, excludes: s.excludes.map((x) => `Not included: ${x}`), prep: s.prep.map((x) => `Customer to arrange: ${x}`) } : { scope: [], excludes: [], prep: [] };
};

const bathroom = small("SCS-10");
const kitchen = small("SCS-12");
const kitchenFull = small("SCS-33");
const sofa = small("SCS-09");
const carpet = small("SCS-13");

export const SERVICE_CATALOG_SEED: CatalogSeed[] = [
  {
    slug: "full-home-premium",
    name: "Full House Deep Cleaning — Premium",
    group: "HOME",
    scopeOfWork: homeScope("Premium"),
    termsConditions: [...homePleaseNote("Premium"), ...CUSTOMER_REQUIREMENTS.map((x) => `Customer to arrange: ${x}`), ...COMMON_TERMS],
    equipmentsUsed: HOME_EQUIPMENT,
  },
  {
    slug: "full-home-platinum",
    name: "Full House Deep Cleaning — Platinum",
    group: "HOME",
    scopeOfWork: homeScope("Platinum"),
    termsConditions: [...homePleaseNote("Platinum"), ...CUSTOMER_REQUIREMENTS.map((x) => `Customer to arrange: ${x}`), ...COMMON_TERMS],
    equipmentsUsed: [...HOME_EQUIPMENT, "Wall wet-cleaning kit", "Chimney degreasing kit"],
  },
  {
    slug: "unfurnished-flat",
    name: "Unfurnished Flat Cleaning (move-in / post-possession)",
    group: "HOME",
    scopeOfWork: [
      "All rooms — floors: dust removal, manual scrubbing and mopping",
      "Windows, glass and sliding channels: cleaning (safe, reachable areas)",
      "Kitchen — platform, sink and wall tiles cleaning; exterior of fixed cabinets",
      "Bathrooms — WC, wash basin, taps, fittings, wall and floor tiles",
      "Doors, switch boards, light fixtures and fans: dusting and wiping",
      "Balcony and utility area: floor cleaning",
      "Loose construction dust and visible debris removal",
    ],
    termsConditions: ["Priced for an empty (unfurnished) home; furnished homes are quoted under the full house packages.", "Heavy construction debris, cement slabs and paint-bucket residue are not removed.", ...COMMON_TERMS],
    equipmentsUsed: [...HOME_EQUIPMENT, "Scrapers for loose dried material (surface-safe)"],
  },
  {
    slug: "bathroom-cleaning",
    name: "Bathroom Cleaning",
    group: "HOME",
    scopeOfWork: bathroom.scope,
    termsConditions: [...bathroom.excludes, ...bathroom.prep, ...COMMON_TERMS],
    equipmentsUsed: ["Descaling and disinfecting solutions suited to tiles and fittings", "Scrubbing brushes and pads", "Wet vacuum", "Microfibre cloths"],
  },
  {
    slug: "kitchen-cleaning",
    name: "Kitchen Cleaning",
    group: "HOME",
    scopeOfWork: [...kitchen.scope, "Kitchen Cleaning with cabinet interiors (on request):", ...kitchenFull.scope],
    termsConditions: [...kitchen.excludes, ...kitchen.prep, ...kitchenFull.excludes, ...COMMON_TERMS],
    equipmentsUsed: ["Food-safe degreasing solutions", "Scrubbing pads and brushes", "Wet-and-dry vacuum", "Microfibre cloths", "Step ladder"],
  },
  {
    slug: "sofa-carpet-shampooing",
    name: "Sofa & Carpet Shampooing",
    group: "HOME",
    scopeOfWork: [...sofa.scope.map((x) => `Sofa — ${x}`), ...carpet.scope.map((x) => `Carpet — ${x}`)],
    termsConditions: [...sofa.excludes, ...sofa.prep, ...carpet.excludes, ...carpet.prep, ...COMMON_TERMS],
    equipmentsUsed: ["Upholstery shampoo and extraction machine", "Vacuum cleaner", "Soft brushes", "Fabric-safe shampoo and stain-treatment products"],
  },
  {
    slug: "office-cleaning",
    name: "Office & Commercial Cleaning",
    group: "COMMERCIAL",
    scopeOfWork: [
      "Work areas — desks, partitions and shelves: dusting and wiping (items left on desks are not moved)",
      "Floors — vacuuming of carpet, mopping or machine scrubbing of hard floor",
      "Pantry / kitchenette — platform, sink and exterior of appliances",
      "Washrooms — WC, wash basins, taps, mirrors, tiles and floor",
      "Glass doors, partitions and reachable windows",
      "Reception, meeting rooms and common areas",
      "Dustbins emptied and cleaned; waste collected to the building collection point",
    ],
    termsConditions: ["Scope, timings and frequency are fixed in writing before the first visit; recurring service is covered by an AMC.", "Cleaning of IT equipment, servers and confidential documents is excluded.", "Building access, parking and permits are arranged by the client.", ...COMMON_TERMS],
    equipmentsUsed: ["Commercial vacuum cleaner", "Single-disc floor scrubbing machine", "Colour-coded microfibre cloths and mops", "Washroom disinfecting solutions", "Glass-cleaning kit", "Caution signboards"],
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    group: "PEST_CONTROL",
    scopeOfWork: [
      "Inspection of the premises and the pest problem to be treated",
      "Treatment of the agreed pest category in the agreed areas using approved products",
      "Application at entry points, cracks, drains and other likely harbourage areas",
      "Safety briefing: what to cover, how long to stay out and when to re-enter",
    ],
    termsConditions: [
      "Treatment is carried out for the pest category named in the quotation only.",
      "Food, utensils, aquariums, pets and plants must be covered or moved before the treatment; occupants and pets stay out for the time the technician advises.",
      "Results depend on the infestation and on follow-up hygiene; no complete or permanent elimination is guaranteed. Any follow-up visit is as written in the quotation.",
      "Access to all areas to be treated, including inside cabinets and beds where relevant, is the customer's responsibility.",
      ...COMMON_TERMS,
    ],
    equipmentsUsed: ["Sprayers and fogging equipment", "Gel and bait applicators", "Approved pest-control products", "Protective gear for technicians"],
  },
  {
    slug: "interior-painting",
    name: "Interior Painting",
    group: "PAINTING",
    scopeOfWork: [
      "Site inspection and measurement; shade and finish confirmed in writing",
      "Covering and protection of floors, fittings and furniture",
      "Surface preparation: scraping loose paint, filling cracks, putty and sanding as agreed",
      "Primer coat where required",
      "Finish coats in the agreed paint and shade",
      "Touch-ups, removal of masking and basic cleaning of the painted area",
    ],
    termsConditions: [
      "Paint brand, shade, number of coats and areas are as written in the quotation; changes are chargeable separately.",
      "Existing dampness, seepage or structural cracks are not repaired unless quoted.",
      "Furniture is moved only where agreed; valuables and fragile items must be removed beforehand.",
      "Minor shade variation between batches and under different lighting is normal.",
      ...COMMON_TERMS,
    ],
    equipmentsUsed: ["Brushes, rollers and spray equipment", "Sanding tools and scrapers", "Putty and primer tools", "Masking material and floor sheets", "Scaffolding or ladders for reachable heights"],
  },
];
