// Room-wise Scope of Work for Sahara's full-house packages — one source for
// the booking form, the landing pages and the CRM job/lead pages, so what the
// customer booked is exactly what the office and crew see.
//
// Content is Sahara's approved scope (marketing-content HOME_BASE_SCOPE and
// the Premium/Platinum wall treatment) re-arranged by room as "item: method".
// Nothing here adds a service Sahara hasn't approved; prices stay in the
// pricing master.

export type ScopeArea = { area: string; items: { item: string; method: string }[] };
export type HomeTier = "Premium" | "Platinum";

const wall = (tier: HomeTier) =>
  tier === "Platinum"
    ? { item: "Walls", method: "Wet cleaning" }
    : { item: "Walls", method: "Dry dusting" };
const ceiling = { item: "Ceiling", method: "Dry dusting" };

export function homeScopeByArea(tier: HomeTier): ScopeArea[] {
  return [
    {
      area: "Living room & bedrooms",
      items: [
        { item: "Floors", method: "Manual scrubbing & mopping" },
        { item: "Window glass", method: "Cleaning · sliding channels vacuumed" },
        { item: "Furniture", method: "Exterior dusting" },
        { item: "Sofa", method: "Dry vacuuming (shampooing is a separate service)" },
        { item: "Lights, fans & doors", method: "Dusting" },
        { item: "Cobwebs & spider webs", method: "Removal" },
        wall(tier),
        ceiling,
      ],
    },
    {
      area: "Kitchen",
      items: [
        { item: "Platform & wall tiles", method: "Cleaning" },
        { item: "Trolleys / cabinets", method: "Exterior cleaning" },
        { item: "Exhaust fan", method: "Cleaning" },
        { item: "Window glass", method: "Cleaning · sliding channels vacuumed" },
        { item: "Floor", method: "Manual scrubbing & mopping" },
      ],
    },
    {
      area: "Bathrooms",
      items: [
        { item: "WC, wash basin, taps & fittings", method: "Cleaning" },
        { item: "Wall & floor tiles", method: "Cleaning" },
        { item: "Floor", method: "Manual scrubbing" },
      ],
    },
    {
      area: "Balcony",
      items: [
        { item: "Balcony", method: "Cleaning" },
        { item: "Floor", method: "Manual scrubbing & mopping" },
      ],
    },
  ];
}

/** 3–4 short points for the package card. */
export function homeHighlights(tier: HomeTier): string[] {
  return [
    "Complete home: rooms, kitchen, bathrooms & balcony",
    "Floor manual scrubbing & mopping",
    tier === "Platinum" ? "Wall wet cleaning + ceiling dry dusting" : "Wall dry dusting + ceiling dry dusting",
    "Estimated 7–8 hours · professional equipment",
  ];
}

export const HOME_DURATION = "Estimated 7–8 hours";

/** Not included / available at extra cost, per tier. */
export function homePleaseNote(tier: HomeTier): string[] {
  return [
    ...(tier === "Premium" ? ["Wall wet cleaning is not included (included in Platinum)."] : []),
    "Sofa, carpet and mattress shampooing are separate services (see Customized).",
    "Kitchen cleaning does not include chimney cleaning.",
    "Inaccessible areas are excluded and heavy furniture is not moved unless agreed.",
    "Old, permanent or stubborn stains cannot be guaranteed for complete removal.",
    "Additional work outside the listed scope may be chargeable.",
  ];
}

/** What the customer arranges — shown with every booking. */
export const CUSTOMER_REQUIREMENTS = [
  "Adequate water supply during the service.",
  "Electricity supply for our equipment.",
  "A suitable ladder / step ladder where required.",
  "Access to all areas to be cleaned.",
  "Cash, jewellery and fragile valuables kept secured before the team starts.",
];

/** Short scope/note lines for a customised (small) service from its pricing-master fields. */
export function smallServiceNotes(item: { unit?: string; rule?: string; scope?: string; priceNote?: string }): string[] {
  return [item.unit && `Priced ${item.unit}`, item.rule, item.scope, item.priceNote].filter(Boolean) as string[];
}

/**
 * Short Scope of Work text frozen on a lead/job at booking time — what the
 * customer selected. Full-house packages point to the room-by-room package
 * scope (shown from this file on the job page / Staff App); other bookings
 * list the selected items. Office staff can edit it in the CRM.
 */
export function scopeSnapshot(input: { packageName?: string | null; serviceVariant?: string | null; items: { name: string; qty: number; unit?: string }[] }): string | null {
  const tier = tierFromPackage(input.packageName, input.serviceVariant);
  if (tier && input.items.length === 1) {
    return `${input.packageName || tier} Home Deep Cleaning — full ${tier} room-by-room package scope (${tier === "Platinum" ? "wall wet cleaning" : "wall dry dusting"} + ceiling dry dusting). Sofa/carpet/mattress shampooing and chimney not included.`;
  }
  if (!input.items.length) return null;
  return input.items.map((i) => `• ${i.name}${i.unit ? ` × ${i.qty} (${i.unit})` : i.qty > 1 ? ` × ${i.qty}` : ""}`).join("\n");
}

/** Resolve the full-house tier from a CRM package / variant string ("2 BHK Platinum"). */
export function tierFromPackage(...values: (string | null | undefined)[]): HomeTier | null {
  const s = values.filter(Boolean).join(" ");
  if (/platinum/i.test(s)) return "Platinum";
  if (/premium/i.test(s)) return "Premium";
  return null;
}
