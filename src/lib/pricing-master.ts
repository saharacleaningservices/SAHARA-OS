// ─────────────────────────────────────────────────────────────────────────
// SAHARA PRICING MASTER — the single source of approved customer prices.
//
//   Landing pages  ─┐
//   Booking page   ─┼─ all read PRICING_MASTER (never their own numbers)
//   CRM price list ─┤
//   Quotations     ─┤  (line items picked from here)
//   WhatsApp / Meta catalogue feed (/api/catalog/feed) ─┘
//
// Change a price HERE ONLY, after the owner approves it. `price` is the
// selling price; `mrp` is the genuine previous price shown struck through
// (omit it when there is none). `price: null` = quoted after inspection.
// `contentId` is the catalogue item id (Commerce Manager feed `id`).
// ─────────────────────────────────────────────────────────────────────────

export type PriceGroup = "PREMIUM" | "PLATINUM" | "INDIVIDUAL" | "COMBO" | "INSPECTION";

export type PriceItem = {
  contentId: string;
  group: PriceGroup;
  name: string;
  /** ServiceCategory used by the CRM / booking (publicBookLead). */
  category: "HOME_DEEP_CLEANING" | "INDIVIDUAL_CLEANING" | "COMBO_PACKAGE" | "COMMERCIAL_CLEANING" | "PEST_CONTROL" | "PAINTING";
  variant: string;
  price: number | null;
  mrp?: number;
  unit?: string;
  minQty?: number;
  rule?: string;
  bhk?: string;
  addOnOnly?: boolean;
};

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
  home("Premium", 1, 4499, 3999, "SCS-01"),
  home("Premium", 2, 5499, 4999, "SCS-02"),
  home("Premium", 3, 6999, 6499, "SCS-03"),
  home("Premium", 4, 7999, 7499, "SCS-04"),
  home("Platinum", 1, 5999, 5499, "SCS-05"),
  home("Platinum", 2, 6999, 6499, "SCS-06"),
  home("Platinum", 3, 8499, 7999, "SCS-07"),
  home("Platinum", 4, 9499, 8999, "SCS-08"),
  { contentId: "SCS-09", group: "INDIVIDUAL", name: "Sofa Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Sofa Cleaning", price: 199, unit: "per seat", minQty: 5, rule: "Minimum 5 seater" },
  { contentId: "SCS-10", group: "INDIVIDUAL", name: "Bathroom Deep Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Bathroom Cleaning", price: 499, unit: "per bathroom", minQty: 2, rule: "Minimum 2 bathrooms" },
  { contentId: "SCS-11", group: "INDIVIDUAL", name: "Mattress Cleaning", category: "INDIVIDUAL_CLEANING", variant: "Mattress Cleaning", price: 699, unit: "per mattress", minQty: 2, rule: "Minimum 2 mattresses" },
  { contentId: "SCS-12", group: "INDIVIDUAL", name: "Kitchen Deep Cleaning (Without Chimney)", category: "INDIVIDUAL_CLEANING", variant: "Kitchen Deep Cleaning", price: 1499, minQty: 1, rule: "Chimney cleaning not included" },
  { contentId: "SCS-26", group: "COMBO", name: "Kitchen + 2 Bathroom + Fridge", category: "COMBO_PACKAGE", variant: "Kitchen + 2 Bathroom + Fridge", price: 3499 },
  { contentId: "SCS-27", group: "COMBO", name: "Kitchen + 3 Bathroom", category: "COMBO_PACKAGE", variant: "Kitchen + 3 Bathroom", price: 3999 },
  { contentId: "SCS-29", group: "COMBO", name: "Sofa + Mattress + Carpet", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Carpet", price: 3999 },
  { contentId: "SCS-28", group: "COMBO", name: "Sofa + Mattress + Fridge", category: "COMBO_PACKAGE", variant: "Sofa + Mattress + Fridge", price: 1999, addOnOnly: true, rule: "Add-on only — booked with another service" },
  { contentId: "SCS-INS-COMMERCIAL", group: "INSPECTION", name: "Office / Commercial / Villa Cleaning", category: "COMMERCIAL_CLEANING", variant: "Commercial Cleaning", price: null },
  { contentId: "SCS-INS-PEST", group: "INSPECTION", name: "Pest Control", category: "PEST_CONTROL", variant: "Pest Control", price: null },
  { contentId: "SCS-INS-PAINTING", group: "INSPECTION", name: "Interior Painting", category: "PAINTING", variant: "Interior Painting", price: null },
];

export const PRICE_GROUP_LABEL: Record<PriceGroup, string> = {
  PREMIUM: "Premium Home Deep Cleaning",
  PLATINUM: "Platinum Home Deep Cleaning",
  INDIVIDUAL: "Individual Services",
  COMBO: "Combo Packages",
  INSPECTION: "Price After Inspection",
};

export const pricesIn = (group: PriceGroup) => PRICING_MASTER.filter((p) => p.group === group);
export const priceByContentId = (id: string) => PRICING_MASTER.find((p) => p.contentId === id) ?? null;

/** Lowest home deep cleaning price — used in "from ₹…" copy. */
export const HOME_FROM_PRICE = Math.min(...pricesIn("PREMIUM").map((p) => p.price ?? Infinity));
export const PLATINUM_FROM_PRICE = Math.min(...pricesIn("PLATINUM").map((p) => p.price ?? Infinity));

/** Line total for a priced item at a quantity (respects the minimum). */
export function lineTotal(item: PriceItem, qty = 1) {
  if (item.price == null) return null;
  return item.price * Math.max(qty, item.minQty ?? 1);
}
