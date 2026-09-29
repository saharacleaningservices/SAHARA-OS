// Customer-facing marketing content shared by the public landing pages.
// PRICES: the live WhatsApp Catalogue (9175220270) is the single source of
// truth — these values mirror it exactly. Change them ONLY after the catalogue
// changes. Services without a catalogue price are enquiry / inspection based.

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
export const PREMIUM: Pkg[] = [
  { bhk: "1 BHK", mrp: 4499, price: 3999 },
  { bhk: "2 BHK", mrp: 5499, price: 4999 },
  { bhk: "3 BHK", mrp: 6999, price: 6499 },
  { bhk: "4 BHK", mrp: 7999, price: 7499 },
];
export const PLATINUM: Pkg[] = [
  { bhk: "1 BHK", mrp: 5999, price: 5499 },
  { bhk: "2 BHK", mrp: 6999, price: 6499 },
  { bhk: "3 BHK", mrp: 8499, price: 7999 },
  { bhk: "4 BHK", mrp: 9499, price: 8999 },
];
export const PREMIUM_SCOPE = [
  "Window glass cleaning & sliding channel vacuuming",
  "Furniture exterior dusting, sofa dry vacuuming",
  "Bathrooms: WC, basin, fittings, taps, wall & floor tiles",
  "Kitchen: platform, tiles, trolley exterior, exhaust fan",
  "Balcony cleaning",
  "Lights, fans & doors dusting",
  "Floor manual scrubbing & mopping",
  "Cobweb & spider web removal, wall & ceiling dry dusting",
];
export const PREMIUM_EXCLUDED = [
  "Wall wet cleaning (included in Platinum)",
  "Sofa / carpet / mattress shampooing (available separately)",
  "Inaccessible areas and moving heavy furniture",
];
// Live catalogue shows only the offer price for these (no strike price).
export const SMALL_SERVICES = [
  { name: "Sofa Cleaning", price: 199, unit: "per seat", rule: "Minimum 5 seater" },
  { name: "Bathroom Deep Cleaning", price: 499, unit: "per bathroom", rule: "Minimum 2 bathrooms" },
  { name: "Mattress Cleaning", price: 699, unit: "per mattress", rule: "Minimum 2 mattresses" },
  { name: "Kitchen Deep Cleaning (Without Chimney)", price: 1499, unit: "", rule: "Chimney cleaning not included" },
];
export const COMBOS = [
  { name: "Kitchen + 2 Bathroom + Fridge", price: 3499, note: "" },
  { name: "Kitchen + 3 Bathroom", price: 3999, note: "" },
  { name: "Sofa + Mattress + Carpet", price: 3999, note: "" },
  { name: "Sofa + Mattress + Fridge", price: 1999, note: "Add-on only — booked with another service" },
];
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
