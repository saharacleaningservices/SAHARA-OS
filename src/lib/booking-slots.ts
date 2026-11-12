// Category-based arrival windows for the website booking flow (owner 2026-11-12). Pure and unit-tested.
//   Full House / Home Deep Cleaning takes 6–8 hours, so only the three morning-to-early-afternoon arrival windows are
//   offered; every slot from 2:00 PM is hidden. Individual / small services (kitchen, bathroom, sofa, carpet …) and pest
//   control show every window from 8:00 AM up to 4:00 PM – 6:00 PM.
// Slot VALUES are the CRM's TIME_SLOTS strings (src/lib/constants.ts) so capacity, auto-confirm and the Job all keep working;
// slotDisplay() only changes how a window is written for the customer.

/** CRM windows allowed for a Full House / Home Deep Cleaning booking. */
export const FULL_HOUSE_SLOTS = ["8:00 – 10:00 AM", "10:00 AM – 12:00 PM", "12:00 – 2:00 PM"] as const;

/** Full-house style bookings: everything in the HOME_DEEP_CLEANING category (Premium, Platinum, Unfurnished, Move-in/out). */
export const isFullHouseCategory = (category?: string | null) => category === "HOME_DEEP_CLEANING";

export function slotsForCategory<T extends { slot: string }>(category: string | null | undefined, slots: T[]): T[] {
  const usable = slots.filter((s) => s.slot !== "Flexible");
  return isFullHouseCategory(category) ? usable.filter((s) => (FULL_HOUSE_SLOTS as readonly string[]).includes(s.slot)) : usable;
}

/** "8:00 – 10:00 AM" → "8:00 AM – 10:00 AM"; "12:00 – 2:00 PM" → "12:00 PM – 2:00 PM"; "10:00 AM – 12:00 PM" is unchanged. */
export function slotDisplay(slot: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i.exec(slot.trim());
  if (!m) return slot;
  const hour = Number(m[1]);
  const period = hour >= 8 && hour < 12 ? "AM" : "PM";
  return `${m[1]}:${m[2]} ${period} – ${m[3]!.toUpperCase().replace(/\s+/, " ")}`;
}
