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
    [walls, "ceiling dry dusting"].filter(Boolean).join(" + "),
    `${HOME_DURATION.replace(/^Estimated /, "approx. ")}`,
  ].join("; ") + ".";
}

/** Short "not included" line for a full-house package (from homePleaseNote). */
export function conciseHomeExclusions(tier: HomeTier | null): string {
  return `Not included: sofa / carpet / mattress shampooing, chimney${tier === "Premium" ? ", wall wet cleaning (Platinum only)" : ""}.`;
}
