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
// Chimney (owner 2026-10-22): Platinum includes full chimney cleaning, Premium the exterior.
const chimney = (tier: HomeTier) =>
  tier === "Platinum" ? { item: "Chimney", method: "Full cleaning" } : { item: "Chimney", method: "Exterior cleaning" };

export function homeScopeByArea(tier: HomeTier): ScopeArea[] {
  return [
    {
      area: "Living room & bedrooms",
      items: [
        { item: "Floors", method: "Manual scrubbing & mopping" },
        { item: "Window glass", method: "Cleaning · sliding channels vacuumed" },
        { item: "Furniture", method: "Exterior dusting" },
        { item: "Sofa", method: "Dry vacuuming (shampooing is a separate service)" },
        { item: "Mattresses, curtains & carpets", method: "Dry vacuuming" },
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
        { item: "Refrigerator & microwave", method: "Exterior cleaning" },
        chimney(tier),
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
    tier === "Platinum" ? "Wall wet cleaning + full chimney cleaning" : "Fridge, microwave & chimney exterior cleaning",
    "Estimated 7–8 hours · professional equipment",
  ];
}

export const HOME_DURATION = "Estimated 7–8 hours";

/** Not included / available at extra cost, per tier. */
export function homePleaseNote(tier: HomeTier): string[] {
  return [
    ...(tier === "Premium" ? ["Wall wet cleaning and full chimney cleaning are included in Platinum (Premium covers the chimney exterior)."] : []),
    "Sofa, carpet and mattress shampooing are separate services (see Customized); dry vacuuming is included.",
    "Inaccessible areas are excluded and heavy furniture is not moved unless agreed.",
    "Old, permanent or stubborn stains cannot be guaranteed for complete removal.",
    "Additional work outside the listed scope may be chargeable.",
  ];
}

/** What the customer arranges — shown with every booking. */
export const CUSTOMER_REQUIREMENTS = [
  "Adequate water supply during the service.",
  "Electricity supply for our equipment.",
  "A step-ladder where required.",
  "Access to all areas to be cleaned.",
  "Cash, jewellery and valuables kept locked under key before the team starts.",
];

/**
 * Written scope of work for each customised (small) service — what is done, what is not, and what the customer
 * prepares. Original wording drafted for Sahara (2026-10-21); no results, timings or warranties are promised. Owner to
 * review before relying on it in contracts. Keyed by pricing-master contentId.
 */
export type SmallServiceScope = { includes: string[]; excludes: string[]; prep: string[] };
const CONFIRM = "Final scope and price are confirmed before booking.";
export const SMALL_SERVICE_SCOPE: Record<string, SmallServiceScope> = {
  "SCS-09": {
    includes: ["Dry vacuuming of each seat, cushion and arm rest", "Upholstery shampoo and extraction with our machine, seat by seat", "Visible stains treated on a best-effort basis"],
    excludes: ["Guaranteed removal of old or set-in stains, dye transfer or fabric wear", "Leather or delicate-fabric treatment unless agreed in advance", "Cleaning of removable covers off site"],
    prep: ["Clear cushions, throws and items from the sofa", "Allow drying time after shampooing and keep the area ventilated"],
  },
  "SCS-10": {
    includes: ["Scrubbing of wall and floor tiles", "Cleaning of WC, wash basin, taps and fittings", "Mirror, glass and visible door surfaces", "Floor drain surface cleaning"],
    excludes: ["Plumbing, leakage or tile repair", "Guaranteed removal of permanent hard-water or rust marks", "Contents of cabinets and shelves"],
    prep: ["Remove personal items, toiletries and valuables", "Water supply available throughout"],
  },
  "SCS-12": {
    includes: ["Kitchen platform, sink and wall tiles", "Exterior of cabinets, trolleys and shelves", "Exhaust fan, window glass and sliding channels", "Floor manual scrubbing and mopping"],
    excludes: ["Chimney cleaning", "Interior of cabinets and appliances", "Removal of utensils, food items or crockery"],
    prep: ["Kitchen emptied by the customer: utensils, food and valuables removed from work surfaces and cabinets", "Gas and electrical appliances switched off"],
  },
  "SCS-33": {
    includes: ["Our team removes utensils and items from cabinets and shelves, cleans the interiors and places items back", "Kitchen platform, sink and wall tiles", "Exterior of cabinets, trolleys and shelves", "Exhaust fan, window glass and sliding channels", "Floor manual scrubbing and mopping"],
    excludes: ["Chimney cleaning", "Interior of appliances (oven, microwave, refrigerator)", "Responsibility for fragile, antique or high-value items — please keep these aside"],
    prep: ["Cash, jewellery and valuables kept secured", "Gas and electrical appliances switched off"],
  },
  "SCS-11": {
    includes: ["Vacuuming of both sides", "Shampoo and extraction on the sleeping surface", "Spot treatment of visible stains on a best-effort basis"],
    excludes: ["Guaranteed removal of old stains, urine odour or discolouration", "Cleaning of waterproof covers or protectors", "Repair of tears or damaged foam"],
    prep: ["Bedding and covers removed", "Allow drying time and keep the room ventilated"],
  },
  "SCS-30": {
    includes: ["Glass panes cleaned from the inside, and the outside where it can be reached safely", "Frames and sliding channels vacuumed and wiped"],
    excludes: ["Exterior glass that cannot be reached safely from inside the home or a safe balcony", "Grill or net removal and re-fitting", "Repair of broken glass, seals or tracks"],
    prep: ["Curtains and blinds moved aside", "Safe access to the window"],
  },
  "SCS-31": {
    includes: ["Vacuuming and cleaning of curtains according to fabric", "Handling and re-hanging by our team where agreed"],
    excludes: ["Guaranteed removal of old stains or fading", "Shrinkage or colour-run risk on delicate or unlabelled fabrics"],
    prep: ["Advise fabric type and any care label", "Access to rods and a safe step"],
  },
  "SCS-32": {
    includes: ["Exterior and door seals wiped", "Interior shelves, trays and walls cleaned once emptied"],
    excludes: ["Repair, gas or compressor work", "Disposal of food", "Cleaning behind or under the unit if it cannot be moved safely"],
    prep: ["Fridge emptied, switched off and defrosted by the customer in advance", "Space around the unit kept clear"],
  },
  "SCS-13": {
    includes: ["Vacuuming of the carpet", "Shampoo and extraction using our machine", "Visible stains treated on a best-effort basis"],
    excludes: ["Guaranteed removal of old or set-in stains or dye marks", "Repair of fraying, burns or damaged backing", "Cleaning of delicate, antique or hand-knotted carpets unless inspected first"],
    prep: ["Furniture moved off the carpet, or access arranged", "Allow drying time and keep the room ventilated"],
  },
};

/** Short scope/note lines for a customised (small) service from its pricing-master fields. */
export function smallServiceNotes(item: { unit?: string; rule?: string; scope?: string; priceNote?: string }): string[] {
  return [item.unit && `Priced ${item.unit}`, item.rule, item.scope, item.priceNote].filter(Boolean) as string[];
}

/** Full written scope for a small service, or null when none is on file (the short notes above still apply). */
export function smallServiceScope(contentId: string): (SmallServiceScope & { confirm: string }) | null {
  const s = SMALL_SERVICE_SCOPE[contentId];
  return s ? { ...s, confirm: CONFIRM } : null;
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
    return `${input.packageName || tier} Home Deep Cleaning — full ${tier} room-by-room package scope (${tier === "Platinum" ? "wall wet cleaning + full chimney cleaning" : "wall dry dusting + chimney exterior"} + ceiling dry dusting). Sofa/carpet/mattress shampooing not included (dry vacuuming included).`;
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

// ── Compact CRM summary ──────────────────────────────────────────────────
// One short line per booked item for CRM / Job Details / Job Card — never the
// room-by-room checklist (that lives on customer-facing scope documents).
// Built only from what was actually saved; nothing is invented.

const listOf = (json: string | null | undefined): string[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  } catch {
    return [];
  }
};

/** "per seat" + 5 → "seats"; "per mattress" + 2 → "mattresses"; 1 → "seat". */
function unitWord(unit: string | null | undefined, qty: number): string {
  const u = (unit ?? "").replace(/^per\s+/i, "").trim();
  if (!u) return "";
  if (qty <= 1) return u;
  return /(s|x|ch|sh)$/i.test(u) ? `${u}es` : `${u}s`;
}

const AUTO_FULL_HOME = /room-by-room package scope/i;

export function compactServiceLines(job: {
  service?: string | null;
  packageName?: string | null;
  serviceVariant?: string | null;
  serviceItems?: string | null;
  comboServices?: string | null;
  addOnServices?: string | null;
  scopeOfWork?: string | null;
}): string[] {
  const lines: { name: string; qty: number; unit?: string | null }[] = [];
  try {
    const raw = job.serviceItems ? JSON.parse(job.serviceItems) : [];
    if (Array.isArray(raw)) {
      for (const l of raw) if (l && typeof l.name === "string") lines.push({ name: l.name, qty: Math.max(1, Number(l.qty) || 1), unit: l.unit ?? null });
    }
  } catch {
    /* unreadable package JSON — fall through to the other saved fields */
  }
  const homeJob = (job.service === "HOME_DEEP_CLEANING" || !job.service) && lines.length <= 1;
  const unfurnished = homeJob && /unfurnished/i.test(`${job.packageName ?? ""} ${job.serviceVariant ?? ""}`);
  const tier = homeJob ? tierFromPackage(job.packageName, job.serviceVariant) : null;
  const out: string[] = [];
  if (tier || unfurnished) {
    out.push(`Full Home Cleaning — ${unfurnished ? "Unfurnished" : tier}`);
  } else if (lines.length) {
    for (const l of lines) {
      const u = unitWord(l.unit, l.qty);
      out.push(`${l.name} × ${l.qty}${u ? ` ${u}` : ""}`);
    }
  }
  for (const c of listOf(job.comboServices)) out.push(`Combo Package — ${c} × 1`);
  for (const a of listOf(job.addOnServices)) out.push(a);
  // Older bookings saved only a scope snapshot: reuse its "• item × qty" lines.
  if (!out.length && job.scopeOfWork && !AUTO_FULL_HOME.test(job.scopeOfWork)) {
    const bullets = job.scopeOfWork.split("\n").map((s) => s.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);
    if (bullets.length && bullets.length <= 12 && bullets.every((b) => b.length <= 80)) out.push(...bullets);
  }
  if (!out.length && job.packageName) out.push(job.packageName);
  return out;
}

/** True when the saved scope is only the auto-generated package sentence / item list (nothing staff typed). */
export function isAutoScope(scope: string | null | undefined): boolean {
  if (!scope) return true;
  return AUTO_FULL_HOME.test(scope) || scope.split("\n").every((l) => /^\s*•\s/.test(l));
}

// ── Concise document scope ───────────────────────────────────────────────
// Quotations / invoices print ONE short scope line for a full-house package
// (the room-by-room checklist stays on the booking page). Wording comes only
// from the approved scope above — nothing new is promised.

/** "Full Home Cleaning — Premium: living room, bedrooms, kitchen, …" — one line, no room-by-room list. */
export function conciseHomeScope(tier: HomeTier | null): string {
  const walls = tier === "Platinum" ? "wall wet cleaning" : tier === "Premium" ? "wall dry dusting" : null;
  return [
    "Living room, bedrooms, kitchen, bathrooms & balcony — floors scrubbed & mopped, window glass, fittings and furniture exterior cleaned",
    [walls, "ceiling dry dusting", tier === "Platinum" ? "full chimney cleaning" : tier === "Premium" ? "chimney exterior" : null].filter(Boolean).join(" + "),
    `${HOME_DURATION.replace(/^Estimated /, "approx. ")}`,
  ].join("; ") + ".";
}

/** Short "not included" line for a full-house package (from homePleaseNote). */
export function conciseHomeExclusions(tier: HomeTier | null): string {
  return `Not included: sofa / carpet / mattress shampooing${tier === "Premium" ? ", wall wet cleaning and full chimney cleaning (Platinum only)" : ""}.`;
}
