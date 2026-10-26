"use server";

import { computeDateAvailability, computeSlotAvailability } from "@/server/slot-capacity";
import { clampDays, isValidYmd } from "@/lib/public-input";

// Public slot availability for the booking forms. The calculation (CRM calendar
// + manual Slot Availability overrides) lives in server/slot-capacity.ts; these
// actions return only what a customer may see — available / full per slot and
// OPEN / FILLING / FULL per day — never booking counts, teams or capacity.
// (DayStatus type: import it from @/server/slot-capacity — a "use server" file may
// only export async functions.)

export async function getSlotAvailability(dateStr: string) {
  if (!isValidYmd(dateStr)) return { ok: false as const };
  const r = await computeSlotAvailability(dateStr);
  if (!r.ok) return { ok: false as const };
  return { ok: true as const, slotsLeft: r.slotsLeft, isFull: r.isFull, label: r.label, slots: r.slots };
}

export async function getDateAvailability(days = 21) {
  return computeDateAvailability(clampDays(days));
}
