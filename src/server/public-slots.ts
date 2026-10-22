import { computeDateAvailability, computeSlotAvailability } from "@/server/slot-capacity";
import { clampDays, isValidYmd } from "@/lib/public-input";

// Customer-visible slot availability for the public API (GET /api/public/v1/slots). Same numbers as the existing public
// actions in actions/slot-availability.ts (which already expose slotsLeft and a "N Slots Left" label): OPEN/FULL per
// slot and AVAILABLE/FILLING/FULL per day. Never teams, capacity or booking counts.

export async function publicSlots(q: { date?: string | null; days?: string | null }) {
  if (q.date) {
    if (!isValidYmd(q.date)) return { ok: false as const };
    const r = await computeSlotAvailability(q.date);
    if (!r.ok) return { ok: false as const };
    return { ok: true as const, body: { date: q.date, isFull: r.isFull, slotsLeft: r.slotsLeft, label: r.label, slots: r.slots } };
  }
  const days = await computeDateAvailability(clampDays(q.days ? Number(q.days) : undefined));
  return { ok: true as const, body: { days } };
}
