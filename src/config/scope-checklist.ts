// "What's included — exact scope" for /services/home-deep-cleaning (owner 2026-11-12). Built from the documented scope
// (lib/service-scope.ts, catalog "Full House Deep Cleaning" and "Unfurnished Home Cleaning") so the page never promises more than the
// quotation and Scope of Work say. Prices come from PRICING_MASTER.
import { PRICING_MASTER } from "@/lib/pricing-master";

const price = (id: string) => PRICING_MASTER.find((i) => i.contentId === id)?.price ?? null;
const inr = (n: number | null) => (n == null ? "" : `₹${n.toLocaleString("en-IN")}`);

export type ScopeRow = { area: string; furnished: string; unfurnished: string };

export const SCOPE_ROWS: ScopeRow[] = [
  {
    area: "Floors (rooms, hall, kitchen)",
    furnished: "Heavy scrubbing machine + mopping",
    unfurnished: "Heavy scrubbing machine + mopping; paint, cement and dust marks removed",
  },
  {
    area: "Kitchen",
    furnished: "Platform, sink, wall tiles, exhaust fan; cabinet and trolley exteriors",
    unfurnished: "Everything in furnished, plus cabinet interiors (kitchen is empty)",
  },
  {
    area: "Wardrobes & cabinets",
    furnished: "Exteriors cleaned; contents and interiors are not touched",
    unfurnished: "Wardrobe and cabinet interiors cleaned",
  },
  {
    area: "Bathrooms",
    furnished: "Descaling of WC, basin, taps, fittings, wall and floor tiles",
    unfurnished: "Descaling of WC, basin, taps, fittings, wall and floor tiles",
  },
  {
    area: "Windows, tracks & grills",
    furnished: "Glass cleaned; sliding channels (tracks) vacuumed",
    unfurnished: "Glass, sliding channels (tracks) and grills",
  },
  {
    area: "Balcony / terrace",
    furnished: "Balcony floor scrubbed and washed, railing wiped; terrace on request",
    unfurnished: "Balcony and utility area scrubbed; terrace on request",
  },
  {
    area: "Fans, lights, doors, cobwebs",
    furnished: "Fans, lights, doors and switchboards dusted; cobwebs removed",
    unfurnished: "Fans, lights, doors and switchboards dusted; cobwebs removed",
  },
  {
    area: "Sofa, mattress, carpet",
    furnished: "Dry vacuuming included; wet shampooing is a separate service",
    unfurnished: "Not applicable (empty flat)",
  },
];

/** Plain-language "not included" list — the same limits the Scope of Work document states. */
export function scopeNotIncluded(): string[] {
  return [
    `Chimney deep cleaning (add-on ${inr(price("SCS-35"))})`,
    `Sofa, mattress and carpet shampooing (separate service, sofa ${inr(price("SCS-09"))} per seat)`,
    "Terrace cleaning, unless agreed and quoted in advance",
    "Inaccessible areas; heavy furniture is not moved unless agreed",
    "Guaranteed removal of old, permanent or paint stains, hard-water and rust marks",
    "Repairs, painting and heavy debris removal",
  ];
}
