// "Add Extra Services (Optional)" per booking category (owner 2026-11-12, updated same day). Pure. Prices are NEVER written
// here: each chip is a pricing-master item (read live through getQuickAddOns) and the server re-prices it by contentId.
//   Full Home & Kitchen → Removing & Placing Back of Kitchen Items · Single / Double Door Fridge Deep Cleaning ·
//                          Microwave Interior Deep Cleaning · Chimney Deep Cleaning
//                          (+ Home only: Sofa Shampooing ₹199 per seat with a quantity stepper, Pest Control Shot)
//   Bathroom       → Window · Balcony
//   Sofa / Mattress / Carpet → Sofa Shampooing (per seat) · Mattress
//   Window / Balcony → Balcony · Window
//   Other individual / combos → Single Fridge · Chimney Deep Cleaning
//   Pest control   → none
// `perUnit` chips get a `- 1 +` stepper in the booking flow (quantity x unit price).

export type AddOnSlot = { contentId: string; label: string; perUnit?: boolean };

const FRIDGE = "SCS-32", FRIDGE_DOUBLE = "SCS-37", MICROWAVE = "SCS-38", KITCHEN_ITEMS = "SCS-39", CHIMNEY = "SCS-35", PEST_SHOT = "SCS-36", BALCONY = "SCS-34", WINDOW = "SCS-30", MATTRESS = "SCS-11", SOFA = "SCS-09";

const KITCHEN_SET: AddOnSlot[] = [
  { contentId: KITCHEN_ITEMS, label: "Removing & Placing Back of Kitchen Items" },
  { contentId: FRIDGE, label: "Single Door Fridge Deep Cleaning" },
  { contentId: FRIDGE_DOUBLE, label: "Double Door Fridge Deep Cleaning" },
  { contentId: MICROWAVE, label: "Microwave Interior Deep Cleaning" },
  { contentId: CHIMNEY, label: "Chimney Deep Cleaning" },
];
const SOFA_SLOT: AddOnSlot = { contentId: SOFA, label: "Sofa Shampooing", perUnit: true };

export function addOnSlotsFor(intent: { category?: string; service?: string }): AddOnSlot[] {
  const svc = (intent.service ?? "").toLowerCase();
  if (intent.category === "PEST_CONTROL") return [];
  // Furnished full-home packages already include chimney cleaning (owner 2026-11-14), so it is not offered again there.
  if (intent.category === "HOME_DEEP_CLEANING") return [...KITCHEN_SET.filter((s) => s.contentId !== CHIMNEY), SOFA_SLOT, { contentId: PEST_SHOT, label: "Kitchen Pest Control" }];
  if (/kitchen/.test(svc)) return KITCHEN_SET;
  if (/bathroom/.test(svc)) return [{ contentId: WINDOW, label: "Window Cleaning" }, { contentId: BALCONY, label: "Balcony Cleaning" }];
  if (/sofa|upholstery|mattress|carpet/.test(svc)) return [SOFA_SLOT, { contentId: MATTRESS, label: "Mattress Cleaning", perUnit: true }];
  if (/window|balcony/.test(svc)) return [{ contentId: BALCONY, label: "Balcony Cleaning" }, { contentId: WINDOW, label: "Window Cleaning" }];
  return [{ contentId: FRIDGE, label: "Single Door Fridge Deep Cleaning" }, { contentId: CHIMNEY, label: "Chimney Deep Cleaning" }];
}
