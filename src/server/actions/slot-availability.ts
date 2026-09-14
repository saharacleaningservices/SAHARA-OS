"use server";

import { db } from "@/lib/db";
import { DAILY_BOOKING_CAPACITY } from "@/lib/constants";

// Real (never fabricated) estimated slot availability for the Smart Calendar.
// Counts actual leads already requesting a given date and compares against a
// configurable daily capacity. This is shown to the customer as an ESTIMATE
// only — "Not a final confirmation" — the real booking is always verified by
// the office team before a job is scheduled. See DAILY_BOOKING_CAPACITY in
// src/lib/constants.ts to tune how many jobs the team can take in a day.
export async function getSlotAvailability(dateStr: string) {
  if (!dateStr) return { ok: false as const };

  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return { ok: false as const };
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const booked = await db.lead.count({
    where: {
      serviceDate: { gte: start, lt: end },
      deletedAt: null,
    },
  });

  const slotsLeft = Math.max(DAILY_BOOKING_CAPACITY - booked, 0);
  const isFull = slotsLeft === 0;
  const label = isFull ? "Full" : `${slotsLeft} Slot${slotsLeft === 1 ? "" : "s"} Left`;

  return { ok: true as const, slotsLeft, isFull, label };
}
