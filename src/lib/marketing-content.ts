import { pricesIn } from "@/lib/pricing-master";

// Customer-facing marketing content shared by the public landing pages.
// PRICES: never defined here — PREMIUM / PLATINUM / SMALL_SERVICES / COMBOS are
// derived from the Sahara pricing master (src/lib/pricing-master.ts), which the
// booking page, CRM price list, quotations and catalogue feed also read.

export const CONTACT = {
  call: ["8956567130", "7083347130"] as const,
  // Customer-service WhatsApp. 9175220270 is the marketing/API sender only
  // and must never appear as a customer-facing number.
  whatsapp: "8956567130",
  email: "contact@saharacleaningservices.com",
  address: "Opposite South Gate, Magarpatta City, Hadapsar, Pune 411028",
};

export const FESTIVAL_CAMPAIGN = "sahara_festival_2026";

export type Pkg = { bhk: string; mrp: number; price: number };
// Prices come from the single pricing master (src/lib/pricing-master.ts).
const toPkg = (g: "PREMIUM" | "PLATINUM"): Pkg[] => pricesIn(g).map((p) => ({ bhk: p.bhk!, mrp: p.mrp ?? p.price!, price: p.price! }));
export const PREMIUM: Pkg[] = toPkg("PREMIUM");
export const PLATINUM: Pkg[] = toPkg("PLATINUM");
// Scope shared by both full-house packages; the wall treatment is the only
// difference (Premium: wall dry dusting · Platinum: wall wet cleaning; both
// include ceiling dry dusting).
export const HOME_BASE_SCOPE = [
  "Window glass cleaning & sliding channel vacuuming",
  "Furniture exterior dusting, sofa dry vacuuming",
  "Bathrooms: WC, basin, fittings, taps, wall & floor tiles",
  "Kitchen: platform, tiles, trolley exterior, exhaust fan",
  "Balcony cleaning",
  "Lights, fans & doors dusting",
  "Floor manual scrubbing & mopping",
  "Cobweb & spider web removal",
];
export const PREMIUM_SCOPE = [...HOME_BASE_SCOPE, "Wall dry dusting & ceiling dry dusting"];
export const PLATINUM_SCOPE = [...HOME_BASE_SCOPE, "Wall wet cleaning & ceiling dry dusting"];
export const PREMIUM_EXCLUDED = [
  "Wall wet cleaning (included in Platinum)",
  "Sofa / carpet / mattress shampooing (available separately)",
  "Inaccessible areas and moving heavy furniture",
];
export const PLATINUM_EXCLUDED = PREMIUM_EXCLUDED.slice(1);
// Equipment the team brings — shown inside each package / service scope.
export const EQUIPMENT = [
  "Commercial vacuum cleaners",
  "Scrubbing machines where applicable",
  "Upholstery shampoo machine for sofa / carpet / mattress",
  "Microfiber system",
  "Appropriate cleaning chemicals",
];
export const SMALL_SERVICES = pricesIn("CUSTOMISED").map((p) => ({ name: p.name, price: p.price, unit: p.unit ?? "", rule: [p.rule, p.scope].filter(Boolean).join(" · "), priceNote: p.priceNote ?? "" }));
export const COMBOS = pricesIn("COMBO").map((p) => ({ name: p.name, price: p.price!, note: p.addOnOnly ? p.rule ?? "Add-on only" : "" }));
export const PEST_SERVICES = [
  { name: "Cockroach Control", desc: "Inspection of kitchen, bathrooms and drains; gel baiting in cracks and crevices; targeted spray where suitable." },
  { name: "Termite Control", desc: "Inspection of wooden furniture, frames and walls; targeted anti-termite treatment of affected areas." },
  { name: "Bed Bug Control", desc: "Inspection of beds, mattresses, sofas and furniture joints; targeted treatment and follow-up guidance." },
  { name: "Ant Control", desc: "Inspection of ant trails and entry points; targeted gel / spray treatment." },
];
export const PAINT_OPTIONS = [
  "Asian Oil Bound Distemper",
  "Asian Tractor Emulsion",
  "Asian Premium Emulsion",
  "Asian Royale",
  "Asian Royale Lustre",
  "Texture Painting",
];
export const PAINT_SCOPE = [
  "Site visit, surface inspection & measurement",
  "Minor surface preparation and crack filling where applicable",
  "Putty and sanding where included",
  "Primer where applicable",
  "Painting — number of coats as per site condition",
  "Edge / corner finishing, basic furniture & floor protection, final cleaning",
];
export const TERMS = [
  "Old, permanent or stubborn stains cannot be guaranteed for complete removal.",
  "Inaccessible areas are excluded from the scope.",
  "Heavy furniture and fixtures are not moved unless separately agreed.",
  "Water and electricity must be available during the service.",
  "Customer should provide access to the service area.",
  "Additional work outside the listed scope may be chargeable.",
  "Payment is due as per the agreed booking terms.",
];
export const EAST_PUNE_AREAS = [
  "Hadapsar", "Magarpatta City", "Amanora Park Town", "Kharadi", "Viman Nagar", "Kalyani Nagar", "Koregaon Park",
  "Mundhwa", "Keshav Nagar", "Wadgaon Sheri", "Wagholi", "NIBM", "Wanowrie", "Kondhwa", "Undri", "Pisoli",
  "Mohammadwadi", "Manjri", "Phursungi", "Camp", "Fatima Nagar",
];
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
