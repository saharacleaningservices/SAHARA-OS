// ─────────────────────────────────────────────────────────────────────────
// SAHARA PRICING MASTER — the single source of approved customer prices.
//
//   Landing pages  ─┐
//   Booking page   ─┼─ all read PRICING_MASTER (never their own numbers,
//   CRM price list ─┤   never the legacy CRM estimate tables in constants.ts)
//   Quotations     ─┤
//   Catalogue feed ─┘  (/marketing/catalog-feed)
//
// Change a price HERE ONLY, after management approval. `price` = selling
// price; `mrp` = genuine previous price shown struck through (omit if none);
// `price: null` = no approved price yet → the customer sees `priceNote`.
// There is NO minimum booking value in the transparent booking flow.
// ─────────────────────────────────────────────────────────────────────────

export type PriceGroup = "PREMIUM" | "PLATINUM" | "CUSTOMISED" | "COMBO" | "PAINTING" | "PEST" | "COMMERCIAL";

export type PriceItem = {
  contentId: string;
  group: PriceGroup;
  name: string;
  /** ServiceCategory used by the CRM / booking (publicBookLead). */
  category: "HOME_DEEP_CLEANING" | "INDIVIDUAL_CLEANING" | "COMBO_PACKAGE" | "COMMERCIAL_CLEANING" | "PEST_CONTROL" | "PAINTING";
  variant: string;
  price: number | null;
  mrp?: number;
  /** e.g. "per seat", "per window", "per sq ft" — present ⇒ quantity-based. */
  unit?: string;
  minQty?: number;
  rule?: string;
  bhk?: string;
  addOnOnly?: boolean;
  /** Shown instead of a price when price is null. */
  priceNote?: string;
  /** Extra scope line shown to the customer. */
  scope?: string;
};

const AFTER_INSPECTION = "Price after inspection";
const ON_CONFIRMATION = "Price confirmed before booking";

/** Customer-facing wording for properties that need a site assessment before any price is quoted. */
export const INSPECTION_NOTE = "Price on inspection — site inspection required";
/** Property types with no fixed package price: 4 BHK and larger, villas, bungalows, full houses, unusual scope. */
export const INSPECTION_PROPERTY_TYPES = ["4 BHK", "5 BHK", "Villa", "Bungalow", "Other"] as const;
/** Catalogue items that are never priced from the master / DB overrides / festival offers (inspection only). */
export const INSPECTION_ONLY_IDS: ReadonlySet<string> = new Set(["SCS-04", "SCS-08"]);

/** True when a home property type must be inspected and quoted by staff (no instant price). */
export function needsInspection(propertyType?: string | null): boolean {
  const t = (propertyType ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return false;
  const bhk = t.match(/^(\d+)\s*bhk\+?$/);
  if (bhk) return Number(bhk[1]) >= 4;
  return INSPECTION_PROPERTY_TYPES.some((p) => p.toLowerCase() === t) || /villa|bungalow|full house/.test(t);
}

/**
 * Customer-facing interior-painting items carry NO price (owner decision 2026-10-09): painting is quoted after
 * a free site inspection. Staff/CRM tools keep the master rates; every public surface (booking widget, landing
 * pages, public booking server action, catalogue feed) passes items through this mask.
 */
export const PAINTING_PUBLIC_NOTE = "Quote after free site inspection";
export function maskPaintingPrices(items: PriceItem[]): PriceItem[] {
  return items.map((i) => (i.group === "PAINTING" ? { ...i, price: null, mrp: undefined, priceNote: PAINTING_PUBLIC_NOTE } : i));
}

const home = (tier: "Premium" | "Platinum", n: number, mrp: number | undefined, price: number | null, id: string): PriceItem => ({
  contentId: id,
  group: tier === "Premium" ? "PREMIUM" : "PLATINUM",
  name: `${n}BHK ${tier} Deep Cleaning`,
  category: "HOME_DEEP_CLEANING",
  variant: tier,
  bhk: `${n} BHK`,
  mrp,
  price,
  ...(price == null ? { priceNote: INSPECTION_NOTE } : {}),
});

export const PRICING_MASTER: PriceItem[] = [
  // Home Cleaning — Premium (owner-approved selling prices 2026-10-09: 1BHK ₹4,499 · 2BHK ₹5,499 · 3BHK ₹6,999;
  // 4BHK existing approved). The old ₹4,000/₹4,999/₹6,499 selling prices are retired; no MRP is shown
  // because there is no genuine earlier price above the new selling price.
  home("Premium", 1, undefined, 4499, "SCS-01"),
  home("Premium", 2, undefined, 5499, "SCS-02"),
  home("Premium", 3, undefined, 6999, "SCS-03"),
  home("Premium", 4, undefined, null, "SCS-04"), // 4 BHK+: price on inspection (owner 2026-10-09) — no fixed price
  // Home Cleaning — Platinum (existing approved master values)
  home("Platinum", 1, 5999, 5499, "SCS-05"),
  home("Platinum", 2, 6999, 6499, "SCS-06"),
  home("Platinum", 3, 8499, 7999, "SCS-07"),
  home("Platinum", 4, undefined, null, "SCS-08"), // 4 BHK+: price on inspection (owner 2026-10-09) — no fixed price

  // Home Cleaning — Customised Cleaning (quantity based)
  { contentId: "SCS-09", group: "CUSTOMISED", name: "Sofa Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Sofa Cleaning", price: 249, unit: "per seat", minQty: 5, rule: "Minimum 5 seats" },
  { contentId: "SCS-10", group: "CUSTOMISED", name: "Bathroom Deep Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Bathroom Cleaning", price: 599, unit: "per bathroom", minQty: 2, rule: "Minimum 2 bathrooms" },
  { contentId: "SCS-12", group: "CUSTOMISED", name: "Kitchen Deep Cleaning (Without Chimney)", category: "INDIVIDUAL_CLEANING", variant: "Kitchen Deep Cleaning", price: 1999, unit: "per kitchen", minQty: 1, rule: "Chimney cleaning not included", scope: "Kitchen emptied / utensils removed by client" },
  { contentId: "SCS-33", group: "CUSTOMISED", name: "Kitchen Deep Cleaning (Utensil removal & placing back)", category: "INDIVIDUAL_CLEANING", variant: "Kitchen Deep Cleaning", price: 2499, unit: "per kitchen", minQty: 1, rule: "Chimney cleaning not included", scope: "Our team removes and places utensils back" },
  { contentId: "SCS-11", group: "CUSTOMISED", name: "Mattress Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Mattress Cleaning", price: 699, unit: "per mattress", minQty: 2, rule: "Minimum 2 mattresses" },
  { contentId: "SCS-30", group: "CUSTOMISED", name: "Window Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Window Cleaning", price: 299, unit: "per window", minQty: 1 },
  // No approved NEW price yet — shown as "price confirmed before booking" (no legacy price used).
  { contentId: "SCS-31", group: "CUSTOMISED", name: "Curtain Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Curtain Cleaning", price: null, unit: "per curtain", minQty: 1, priceNote: ON_CONFIRMATION, scope: "Includes curtain dry cleaning" },
  { contentId: "SCS-32", group: "CUSTOMISED", name: "Fridge Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Refrigerator Cleaning", price: null, unit: "per fridge", minQty: 1, priceNote: ON_CONFIRMATION },
  { contentId: "SCS-13", group: "CUSTOMISED", name: "Carpet Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Carpet Cleaning", price: null, unit: "per carpet", minQty: 1, priceNote: ON_CONFIRMATION },

  // Combo packages (approved catalogue prices)
  { contentId: "SCS-26", group: "COMBO", name: "Kitchen + 2 Bathroom + Fridge", category: "COMBO_PACKAGE", variant: "Kitchen + 2 Bathroom + Fridge", price: 3499, rule: "Empty kitchen · 2 bathrooms · fridge · approx. 3 hrs, 2 workers" },
  { contentId: "SCS-27", group: "COMBO", name: "Kitchen + 3 Bathroom", category: "COMBO_PACKAGE", variant: "Kitchen + 3 Bathroom", price: 3999, rule: "Empty kitchen · 3 bathrooms · approx. 3 hrs, 2 workers" },
  { contentId: "SCS-29", group: "COMBO", name: "Sofa + Mattress + Carpet", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Carpet", price: 3999, rule: "5-seat sofa · 2 mattresses · small carpet · approx. 3 hrs, 2 workers" },
  // Room / Bedroom care combos (owner-approved 2026-10-07, public booking enabled).
  { contentId: "SCS-RC-1", group: "COMBO", name: "Master Bedroom + Balcony + Bathroom", category: "COMBO_PACKAGE", variant: "Master Bedroom + Balcony + Bathroom", price: 2799, rule: "1 master bedroom · 1 balcony · 1 bathroom · approx. 3 hrs, 2 workers" },
  { contentId: "SCS-RC-2", group: "COMBO", name: "Bedroom + Bathroom + Balcony", category: "COMBO_PACKAGE", variant: "Bedroom + Bathroom + Balcony", price: 2199, rule: "1 bedroom · 1 bathroom · 1 balcony · approx. 3 hrs, 2 workers" },
  { contentId: "SCS-RC-3", group: "COMBO", name: "Living Room + Balcony", category: "COMBO_PACKAGE", variant: "Living Room + Balcony", price: 1899, rule: "Living room · 1 balcony · approx. 3 hrs, 2 workers" },
  { contentId: "SCS-28", group: "COMBO", name: "Sofa + Mattress + Fridge", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Fridge", price: 1999, addOnOnly: true, rule: "Add-on only — booked with another service" },

  // Interior Painting — existing approved per-sq-ft structure (estimate; final after site measurement)
  { contentId: "SCS-20", group: "PAINTING", name: "Asian Oil Bound Distemper", category: "PAINTING", variant: "Oil Bound", price: 14, unit: "per sq ft" },
  { contentId: "SCS-21", group: "PAINTING", name: "Asian Tractor Emulsion", category: "PAINTING", variant: "Tractor Emulsion", price: 10, unit: "per sq ft" },
  { contentId: "SCS-22", group: "PAINTING", name: "Asian Premium Emulsion", category: "PAINTING", variant: "Premium Emulsion", price: 18, unit: "per sq ft" },
  { contentId: "SCS-23", group: "PAINTING", name: "Asian Royale", category: "PAINTING", variant: "Royal Emulsion", price: 22, unit: "per sq ft" },
  { contentId: "SCS-24", group: "PAINTING", name: "Asian Royale Lustre", category: "PAINTING", variant: "Royal Lustre", price: 26, unit: "per sq ft" },
  { contentId: "SCS-25", group: "PAINTING", name: "Texture Painting", category: "PAINTING", variant: "Texture Painting", price: 45, unit: "per sq ft" },
  { contentId: "SCS-PUTTY", group: "PAINTING", name: "Putty (optional)", category: "PAINTING", variant: "Putty", price: 12, unit: "per sq ft", addOnOnly: true },

  // Pest Control — inspection based (no approved NEW prices)
  { contentId: "SCS-16", group: "PEST", name: "Cockroach Control", category: "PEST_CONTROL", variant: "Cockroach Control", price: null, priceNote: AFTER_INSPECTION },
  { contentId: "SCS-17", group: "PEST", name: "Termite Control", category: "PEST_CONTROL", variant: "Termite Control", price: null, priceNote: AFTER_INSPECTION },
  { contentId: "SCS-18", group: "PEST", name: "Bed Bug Control", category: "PEST_CONTROL", variant: "Bed Bug Control", price: null, priceNote: AFTER_INSPECTION },
  { contentId: "SCS-19", group: "PEST", name: "Ant Control", category: "PEST_CONTROL", variant: "Ant Control", price: null, priceNote: AFTER_INSPECTION },

  // Commercial Cleaning — requirement assessment
  ...["Shop", "Office", "Warehouse", "Clinic", "Other Commercial"].map((t, i) => ({
    contentId: `SCS-COM-${i + 1}`,
    group: "COMMERCIAL" as const,
    name: `${t} Cleaning`,
    category: "COMMERCIAL_CLEANING" as const,
    variant: t,
    price: null,
    priceNote: "Price after inspection / requirement assessment",
  })),
];

export const PRICE_GROUP_LABEL: Record<PriceGroup, string> = {
  PREMIUM: "Premium Home Deep Cleaning",
  PLATINUM: "Platinum Home Deep Cleaning",
  CUSTOMISED: "Customised Cleaning",
  COMBO: "Combo Packages",
  PAINTING: "Interior Painting",
  PEST: "Pest Control",
  COMMERCIAL: "Commercial Cleaning",
};

export const PRICING_NOTICE =
  "Pricing Notice: The prices displayed are our standard service rates and may vary based on service location, scope, accessibility, demand and other operational requirements. During peak/festival seasons or urgent/same-day bookings, applicable rates may be higher. Any applicable additional charges will be communicated before booking confirmation.";
export const SERVICE_AREA_NOTICE =
  "Displayed standard package prices apply to our standard serviceable areas. Additional charges may apply for locations outside the standard service area, depending on distance and service requirements.";

export const pricesIn = (group: PriceGroup) => PRICING_MASTER.filter((p) => p.group === group);
export const priceByContentId = (id: string) => PRICING_MASTER.find((p) => p.contentId === id) ?? null;
export const priceLabel = (p: PriceItem) => (p.price == null ? p.priceNote ?? AFTER_INSPECTION : `₹${p.price.toLocaleString("en-IN")}${p.unit ? ` ${p.unit}` : ""}`);

/** Lowest home deep cleaning price — used in "from ₹…" copy. */
export const HOME_FROM_PRICE = Math.min(...pricesIn("PREMIUM").map((p) => p.price ?? Infinity));
export const PLATINUM_FROM_PRICE = Math.min(...pricesIn("PLATINUM").map((p) => p.price ?? Infinity));

/** Line total for a priced item at a quantity (respects the item's own minimum quantity only). */
export function lineTotal(item: PriceItem, qty = 1) {
  if (item.price == null) return null;
  return item.price * Math.max(qty, item.minQty ?? 1);
}

// ── Live pricing (Super Admin → Pricing & Packages) ──────────────────────
// The catalogue above supplies names/scope/units and default numbers; the
// server (src/server/pricing.ts) overlays the CRM-edited regular prices and
// festival offers and hands this shape to pages and the booking form.

export type FestivalWindow = {
  id: string;
  name: string;
  /** Calendar dates, inclusive, "YYYY-MM-DD". */
  start: string;
  end: string;
  /** contentId → festival price. Items without an entry keep the regular price. */
  prices: Record<string, number>;
};

export type LivePricing = { items: PriceItem[]; festivals: FestivalWindow[] };

export type PriceType = "REGULAR" | "FESTIVAL";

/** Festival whose window contains the given "YYYY-MM-DD" date, if any. */
export function festivalForDate(festivals: FestivalWindow[], ymd: string): FestivalWindow | null {
  return festivals.find((f) => ymd >= f.start && ymd <= f.end) ?? null;
}

/** Festivals still bookable on/after the given date (today), soonest first. */
export function upcomingFestivals(festivals: FestivalWindow[], todayYmd: string): FestivalWindow[] {
  return festivals.filter((f) => f.end >= todayYmd).sort((a, b) => a.start.localeCompare(b.start));
}

/** Today's calendar date in India ("YYYY-MM-DD") — festival windows are IST calendar dates. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** The six full-home packages that carry festival prices (Premium / Platinum, 1–3 BHK). */
export const FESTIVAL_PACKAGE_IDS: ReadonlySet<string> = new Set(["SCS-01", "SCS-02", "SCS-03", "SCS-05", "SCS-06", "SCS-07"]);

export type Campaign = { current: FestivalWindow; windows: FestivalWindow[]; start: string; end: string };

/**
 * The festival campaign running today, or null. The campaign spans from the earliest festival start to
 * the latest festival end (windows may touch or have gaps). While it is active, customer-facing pages
 * show festival packages only; once it ends (or before it starts) regular packages show again. This
 * uses the existing FestivalOffer windows — no separate switch to maintain.
 */
export function activeCampaign(festivals: FestivalWindow[], todayYmd: string): Campaign | null {
  if (!festivals.length) return null;
  const windows = [...festivals].sort((a, b) => a.start.localeCompare(b.start));
  const start = windows[0].start;
  const end = windows.reduce((e, f) => (f.end > e ? f.end : e), windows[0].end);
  if (todayYmd < start || todayYmd > end) return null;
  const current = windows.find((f) => todayYmd >= f.start && todayYmd <= f.end) ?? windows.find((f) => f.start > todayYmd);
  return current ? { current, windows, start, end } : null;
}

/**
 * Festival names for customer-facing copy ("Navratri • Dussehra • Diwali") while the campaign runs, else
 * null — so hero lines and meta descriptions stop mentioning a festival the day after it ends, driven by
 * the same Settings → Pricing windows as the prices (no hard-coded dates).
 */
export function campaignFestivalNames(festivals: FestivalWindow[], todayYmd: string): string | null {
  const campaign = activeCampaign(festivals, todayYmd);
  if (!campaign) return null;
  const names = [...new Set(campaign.windows.map((w) => w.name))];
  return names.length ? names.join(" • ") : null;
}

/** Lowest Premium home package price a customer actually pays (festival price during a festival window). */
export function homeFromPrice(items: PriceItem[], festival: FestivalWindow | null = null): number {
  const v = items.filter((p) => p.group === "PREMIUM").map((p) => unitPriceFor(p, festival)).filter((n): n is number => n != null);
  return v.length ? Math.min(...v) : HOME_FROM_PRICE;
}

/** Unit price for an item under a festival (or regular when null / no festival price). */
export function unitPriceFor(item: PriceItem, festival: FestivalWindow | null): number | null {
  if (INSPECTION_ONLY_IDS.has(item.contentId)) return null; // inspection-only: never priced, even if a DB row exists
  if (festival && festival.prices[item.contentId] != null) return festival.prices[item.contentId];
  return item.price;
}

export const inGroup = (items: PriceItem[], group: PriceGroup) => items.filter((p) => p.group === group);

/** Short customer-facing booking terms — shown on the booking form, job page and Staff App. */
export const BOOKING_TERMS = [
  "Package price applies to the selected scope.",
  "Additional work is chargeable separately after customer approval.",
  "Additional charges may apply for distant locations or urgent/same-day requirements where applicable.",
  "Final service scope is confirmed at booking.",
  "Festival slots are subject to team availability.",
];
