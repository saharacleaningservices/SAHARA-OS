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

const home = (tier: "Premium" | "Platinum", n: number, mrp: number, price: number, id: string): PriceItem => ({
  contentId: id,
  group: tier === "Premium" ? "PREMIUM" : "PLATINUM",
  name: `${n}BHK ${tier} Deep Cleaning`,
  category: "HOME_DEEP_CLEANING",
  variant: tier,
  bhk: `${n} BHK`,
  mrp,
  price,
});

export const PRICING_MASTER: PriceItem[] = [
  // Home Cleaning — Premium (approved: 1BHK ₹4,000 · 2BHK ₹4,999 · 3BHK ₹6,499; 4BHK existing approved)
  home("Premium", 1, 4499, 4000, "SCS-01"),
  home("Premium", 2, 5499, 4999, "SCS-02"),
  home("Premium", 3, 6999, 6499, "SCS-03"),
  home("Premium", 4, 7999, 7499, "SCS-04"),
  // Home Cleaning — Platinum (existing approved master values)
  home("Platinum", 1, 5999, 5499, "SCS-05"),
  home("Platinum", 2, 6999, 6499, "SCS-06"),
  home("Platinum", 3, 8499, 7999, "SCS-07"),
  home("Platinum", 4, 9499, 8999, "SCS-08"),

  // Home Cleaning — Customised Cleaning (quantity based)
  { contentId: "SCS-09", group: "CUSTOMISED", name: "Sofa Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Sofa Cleaning", price: 199, unit: "per seat", minQty: 5, rule: "Minimum 5 seats" },
  { contentId: "SCS-10", group: "CUSTOMISED", name: "Bathroom Deep Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Bathroom Cleaning", price: 499, unit: "per bathroom", minQty: 2, rule: "Minimum 2 bathrooms" },
  { contentId: "SCS-12", group: "CUSTOMISED", name: "Kitchen Deep Cleaning (Without Chimney)", category: "INDIVIDUAL_CLEANING", variant: "Kitchen Deep Cleaning", price: 1499, unit: "per kitchen", minQty: 1, rule: "Chimney cleaning not included" },
  { contentId: "SCS-11", group: "CUSTOMISED", name: "Mattress Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Mattress Cleaning", price: 699, unit: "per mattress", minQty: 2, rule: "Minimum 2 mattresses" },
  { contentId: "SCS-30", group: "CUSTOMISED", name: "Window Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Window Cleaning", price: 250, unit: "per window", minQty: 1 },
  // No approved NEW price yet — shown as "price confirmed before booking" (no legacy price used).
  { contentId: "SCS-31", group: "CUSTOMISED", name: "Curtain Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Curtain Cleaning", price: null, unit: "per curtain", minQty: 1, priceNote: ON_CONFIRMATION, scope: "Includes curtain dry cleaning" },
  { contentId: "SCS-32", group: "CUSTOMISED", name: "Fridge Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Refrigerator Cleaning", price: null, unit: "per fridge", minQty: 1, priceNote: ON_CONFIRMATION },
  { contentId: "SCS-13", group: "CUSTOMISED", name: "Carpet Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Carpet Cleaning", price: null, unit: "per carpet", minQty: 1, priceNote: ON_CONFIRMATION },

  // Combo packages (approved catalogue prices)
  { contentId: "SCS-26", group: "COMBO", name: "Kitchen + 2 Bathroom + Fridge", category: "COMBO_PACKAGE", variant: "Kitchen + 2 Bathroom + Fridge", price: 3499 },
  { contentId: "SCS-27", group: "COMBO", name: "Kitchen + 3 Bathroom", category: "COMBO_PACKAGE", variant: "Kitchen + 3 Bathroom", price: 3999 },
  { contentId: "SCS-29", group: "COMBO", name: "Sofa + Mattress + Carpet", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Carpet", price: 3999 },
  { contentId: "SCS-28", group: "COMBO", name: "Sofa + Mattress + Fridge", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Fridge", price: 1999, addOnOnly: true, rule: "Add-on only — booked with another service" },

  // Interior Painting — existing approved per-sq-ft structure (estimate; final after site measurement)
  { contentId: "SCS-20", group: "PAINTING", name: "Asian Oil Bound Distemper", category: "PAINTING", variant: "Oil Bound", price: 14, unit: "per sq ft" },
  { contentId: "SCS-21", group: "PAINTING", name: "Asian Tractor Emulsion", category: "PAINTING", variant: "Tractor Emulsion", price: null, unit: "per sq ft", priceNote: AFTER_INSPECTION },
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
