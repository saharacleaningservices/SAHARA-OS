// "Add Extra Services (Optional)" per booking category (owner 2026-11-12). Pure. Prices are NEVER written here: each chip
// is a pricing-master item (read live through getQuickAddOns) and the server re-prices it by contentId.
//   Full Home      → Fridge · Chimney · Pest Control Shot   (Balcony is already part of the Full Home scope)
//   Kitchen        → Fridge Interior · Chimney Deep Cleaning (Microwave Interior: add once it has a price in the pricing master)
//   Bathroom       → Window · Balcony                        (Exhaust / Mirror: add once priced in the pricing master)
//   Sofa / Mattress/ Carpet → Mattress · Sofa
//   Window / Balcony → Balcony · Window
//   Other individual / combos → Fridge · Chimney
//   Pest control   → none

export type AddOnSlot = { contentId: string; label: string };

const FRIDGE = "SCS-32", CHIMNEY = "SCS-35", PEST_SHOT = "SCS-36", BALCONY = "SCS-34", WINDOW = "SCS-30", MATTRESS = "SCS-11", SOFA = "SCS-09";

export function addOnSlotsFor(intent: { category?: string; service?: string }): AddOnSlot[] {
  const svc = (intent.service ?? "").toLowerCase();
  if (intent.category === "PEST_CONTROL") return [];
  if (intent.category === "HOME_DEEP_CLEANING") return [{ contentId: FRIDGE, label: "Fridge" }, { contentId: CHIMNEY, label: "Chimney" }, { contentId: PEST_SHOT, label: "Pest Control Shot" }];
  if (/kitchen/.test(svc)) return [{ contentId: FRIDGE, label: "Fridge Interior Cleaning" }, { contentId: CHIMNEY, label: "Chimney Deep Cleaning" }];
  if (/bathroom/.test(svc)) return [{ contentId: WINDOW, label: "Window Cleaning" }, { contentId: BALCONY, label: "Balcony Cleaning" }];
  if (/sofa|upholstery|mattress|carpet/.test(svc)) return [{ contentId: MATTRESS, label: "Mattress Cleaning" }, { contentId: SOFA, label: "Sofa Cleaning" }];
  if (/window|balcony/.test(svc)) return [{ contentId: BALCONY, label: "Balcony Cleaning" }, { contentId: WINDOW, label: "Window Cleaning" }];
  return [{ contentId: FRIDGE, label: "Fridge" }, { contentId: CHIMNEY, label: "Chimney" }];
}
