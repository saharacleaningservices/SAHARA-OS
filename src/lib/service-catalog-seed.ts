// Service Catalog defaults (owner 2026-10-22, compacted 2026-10-23): scope of work, terms & conditions and equipment for every
// major service, written to fit a single A4 page — a few grouped scope bullets and exactly five core terms.
//
// Where Sahara already has approved wording (the Premium/Platinum home scope, the customised-service scopes) it is reused and
// only grouped, so the catalog can never disagree with the booking page. Everything else is ORIGINAL draft wording written for
// Sahara — it promises no results, timings or warranties — and is seeded with `reviewed: false` so the owner sees which entries
// still need a read-through. No prices live here (pricing master only).
import { SMALL_SERVICE_SCOPE, homeScopeByArea, type HomeTier } from "@/lib/service-scope";

export type CatalogGroup = "HOME" | "COMMERCIAL" | "PEST_CONTROL" | "PAINTING";
export type CatalogSeed = {
  slug: string;
  name: string;
  group: CatalogGroup;
  scopeOfWork: string[];
  termsConditions: string[];
  equipmentsUsed: string[];
};

/** The three clauses the owner requires on every quotation (2026-10-22). */
export const VALUABLES_CLAUSE = "Valuables: keep cash, jewellery and valuables locked under key before the team starts; Sahara is not responsible for items left unsecured.";
export const HIGH_RISE_CLAUSE = "High-rise safety: windows and glass are cleaned only from safe, reachable positions inside the premises or a secure balcony; no work is done at height without safety arrangements.";
export const POST_INTERIOR_DISCLAIMER = "Results: old, permanent or stubborn stains, and dried paint, glue, putty or cement marks left after interior work, cannot be guaranteed to come off fully; we make a best effort without damaging the surface.";

const SCOPE_CLAUSE = "Scope & charges: the price covers the scope listed here; extra work is done only after your approval and charged separately, and distant, urgent or festival-day bookings may carry an extra charge.";
const CUSTOMER_CLAUSE = "Customer to arrange: water and electricity, a step-ladder where needed and access to all areas; heavy furniture is moved only if agreed.";

/** Exactly five core clauses; the second is tailored to the service. */
const terms = (customer: string = CUSTOMER_CLAUSE): string[] => [SCOPE_CLAUSE, customer, VALUABLES_CLAUSE, HIGH_RISE_CLAUSE, POST_INTERIOR_DISCLAIMER];

const HOME_EQUIPMENT = ["Industrial wet-and-dry vacuum", "Floor scrubbing & mopping kit", "Microfibre cloths, brushes & scrapers", "Surface-appropriate cleaning chemicals", "Glass-cleaning squeegee set", "Step ladders for reachable heights"];

const group = (label: string, items: string[]) => `${label}: ${items.join("; ")}.`;
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)); // keeps acronyms such as WC

const homeScope = (tier: HomeTier) => homeScopeByArea(tier).map((a) => group(a.area, a.items.map((i) => `${lower(i.item)}: ${lower(i.method)}`)));

const incl = (id: string) => SMALL_SERVICE_SCOPE[id]?.includes ?? [];
const prep = (id: string) => (SMALL_SERVICE_SCOPE[id]?.prep ?? []).map(lower).join("; ");
const excl = (id: string) => (SMALL_SERVICE_SCOPE[id]?.excludes ?? []).map(lower).join("; ");

export const SERVICE_CATALOG_SEED: CatalogSeed[] = [
  {
    slug: "full-home-premium",
    name: "Full House Deep Cleaning — Premium",
    group: "HOME",
    scopeOfWork: homeScope("Premium"),
    termsConditions: terms(`${CUSTOMER_CLAUSE.replace(/\.$/, "")}. Sofa, carpet and mattress shampooing are separate services; dry vacuuming is included.`),
    equipmentsUsed: HOME_EQUIPMENT,
  },
  {
    slug: "full-home-platinum",
    name: "Full House Deep Cleaning — Platinum",
    group: "HOME",
    scopeOfWork: homeScope("Platinum"),
    termsConditions: terms(`${CUSTOMER_CLAUSE.replace(/\.$/, "")}. Sofa, carpet and mattress shampooing are separate services; dry vacuuming is included.`),
    equipmentsUsed: [...HOME_EQUIPMENT, "Wall wet-cleaning kit", "Chimney degreasing kit"],
  },
  {
    slug: "unfurnished-flat",
    name: "Unfurnished Flat Cleaning (move-in / post-possession)",
    group: "HOME",
    scopeOfWork: [
      "All rooms: floors dusted, scrubbed & mopped; doors, switch boards, light fixtures & fans wiped; loose construction dust removed.",
      "Kitchen: platform, sink & wall tiles; exterior of fixed cabinets.",
      "Bathrooms & balcony: WC, wash basin, taps & fittings; wall & floor tiles; balcony floor.",
      "Windows: glass & sliding channels in safe, reachable areas.",
    ],
    termsConditions: terms(`${CUSTOMER_CLAUSE.replace(/\.$/, "")}. Priced for an empty home; heavy debris and cement slabs are not removed.`),
    equipmentsUsed: [...HOME_EQUIPMENT, "Surface-safe scrapers"],
  },
  {
    slug: "bathroom-cleaning",
    name: "Bathroom Cleaning",
    group: "HOME",
    scopeOfWork: [group("Includes", incl("SCS-10")), group("Not included", (SMALL_SERVICE_SCOPE["SCS-10"]?.excludes ?? []).map(lower))],
    termsConditions: terms(`Customer to arrange: ${prep("SCS-10")}.`),
    equipmentsUsed: ["Descaling & disinfecting solutions", "Scrubbing brushes & pads", "Wet vacuum", "Microfibre cloths"],
  },
  {
    slug: "kitchen-cleaning",
    name: "Kitchen Cleaning",
    group: "HOME",
    scopeOfWork: [
      group("Standard", incl("SCS-12")),
      group("With cabinet interiors (on request)", incl("SCS-33")),
      `Not included: ${excl("SCS-12")}.`,
    ],
    termsConditions: terms(`Customer to arrange: ${prep("SCS-12")}.`),
    equipmentsUsed: ["Food-safe degreasing solutions", "Scrubbing pads & brushes", "Wet-and-dry vacuum", "Microfibre cloths", "Step ladder"],
  },
  {
    slug: "sofa-carpet-shampooing",
    name: "Sofa & Carpet Shampooing",
    group: "HOME",
    scopeOfWork: [group("Sofa", incl("SCS-09")), group("Carpet", incl("SCS-13")), `Not included: ${excl("SCS-09")}.`],
    termsConditions: terms(`Customer to arrange: ${prep("SCS-09")}; furniture moved off carpets or access arranged.`),
    equipmentsUsed: ["Upholstery shampoo & extraction machine", "Vacuum cleaner", "Soft brushes", "Fabric-safe shampoo & stain treatment"],
  },
  {
    slug: "office-cleaning",
    name: "Office & Commercial Cleaning",
    group: "COMMERCIAL",
    scopeOfWork: [
      "Work areas: desks, partitions & shelves dusted and wiped (desk items not moved); carpet vacuumed, hard floors mopped or machine-scrubbed.",
      "Pantry & washrooms: platform, sink, WC, wash basins, taps, mirrors, tiles & floor.",
      "Glass doors, partitions & reachable windows; reception, meeting rooms & common areas.",
      "Dustbins emptied and cleaned; waste taken to the building collection point.",
    ],
    termsConditions: terms("Customer to arrange: building access, parking and permits; scope, timings and frequency are fixed in writing (recurring service via AMC). IT equipment, servers and confidential documents are not cleaned."),
    equipmentsUsed: ["Commercial vacuum cleaner", "Single-disc floor scrubbing machine", "Colour-coded microfibre cloths & mops", "Washroom disinfectants", "Glass-cleaning kit"],
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    group: "PEST_CONTROL",
    scopeOfWork: [
      "Inspection of the premises and the pest problem to be treated.",
      "Treatment of the agreed pest category in the agreed areas with approved products, including entry points, cracks and drains.",
      "Safety briefing: what to cover, how long to stay out and when to re-enter.",
    ],
    termsConditions: terms("Customer to arrange: access to all areas to be treated; food, utensils, aquariums, pets and plants covered or moved, and occupants out for the time the technician advises. Treatment covers only the pest named in the quotation; no permanent elimination is guaranteed."),
    equipmentsUsed: ["Sprayers & fogging equipment", "Gel & bait applicators", "Approved pest-control products", "Technician protective gear"],
  },
  {
    slug: "interior-painting",
    name: "Interior Painting",
    group: "PAINTING",
    scopeOfWork: [
      "Site inspection & measurement; shade, finish and number of coats confirmed in writing.",
      "Preparation: floors, fittings & furniture covered; loose paint scraped, cracks filled, putty & sanding as agreed; primer where required.",
      "Finish coats in the agreed paint & shade; touch-ups, masking removed and basic clean-up of the painted area.",
    ],
    termsConditions: terms("Customer to arrange: furniture and valuables cleared beforehand; dampness, seepage and structural cracks are not repaired unless quoted. Minor shade variation across batches and lighting is normal."),
    equipmentsUsed: ["Brushes, rollers & spray equipment", "Sanding tools & scrapers", "Putty & primer tools", "Masking material & floor sheets", "Ladders / scaffolding for reachable heights"],
  },
];

/** Kept for callers that want the shared clauses on their own. */
export const COMMON_TERMS: string[] = terms();
