"use server";

import { db } from "@/lib/db";
import {
  BLOCKED_BOOKING_DATES,
  BOOKING_JOB_DURATION_HOURS,
  BOOKING_TEAM_COUNT,
  DAILY_BOOKING_CAPACITY,
  TIME_SLOTS,
} from "@/lib/constants";

// Real slot availability for the public booking forms, computed from the CRM
// calendar: every scheduled Job (not cancelled) plus every open booking
// request (a Lead with a service date that hasn't become a job yet) occupies
// one team for BOOKING_JOB_DURATION_HOURS from its arrival window. A slot is
// available while fewer than BOOKING_TEAM_COUNT bookings overlap it and the
// day is under DAILY_BOOKING_CAPACITY. Only "available / full" is returned —
// never teams, staff or customers. The office still confirms every request.

const OPEN_REQUEST_STAGES = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION", "CONFIRMED"];

/** Start hour (24h) of a slot / job time like "8:00 – 11:00", "1:00 – 4:00" or "10:00 AM"; null = flexible/unknown. */
function startHour(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  else if (!ampm && h < 7) h += 12; // business windows: 1:00–3:00 starts are afternoon
  return h;
}

export async function getSlotAvailability(dateStr: string) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false as const };
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) return { ok: false as const };
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
  const closed = start < today || (BLOCKED_BOOKING_DATES as readonly string[]).includes(dateStr);

  const [jobs, requests] = closed
    ? [[], []]
    : await Promise.all([
        db.job.findMany({
          where: { scheduledDate: { gte: start, lt: end }, deletedAt: null, isDemo: false, status: { not: "CANCELLED" } },
          select: { scheduledTime: true },
        }),
        db.lead.findMany({
          where: { serviceDate: { gte: start, lt: end }, deletedAt: null, stage: { in: OPEN_REQUEST_STAGES as never } },
          select: { timeSlot: true },
        }),
      ]);

  const bookedStarts = [...jobs.map((j) => startHour(j.scheduledTime)), ...requests.map((r) => startHour(r.timeSlot))];
  const dayTotal = bookedStarts.length;
  const dayOpen = !closed && dayTotal < DAILY_BOOKING_CAPACITY;

  const slots: { slot: string; available: boolean }[] = TIME_SLOTS.filter((s) => s !== "Flexible").map((slot) => {
    const t = startHour(slot)!;
    const overlapping = bookedStarts.filter((b) => b === null || Math.abs(b - t) < BOOKING_JOB_DURATION_HOURS).length;
    return { slot, available: dayOpen && overlapping < BOOKING_TEAM_COUNT };
  });
  const anyOpen = slots.some((s) => s.available);
  slots.push({ slot: "Flexible", available: anyOpen });

  const slotsLeft = closed ? 0 : Math.max(DAILY_BOOKING_CAPACITY - dayTotal, 0);
  const isFull = !anyOpen;
  const label = closed ? "Not available" : isFull ? "Full" : `${slotsLeft} Slot${slotsLeft === 1 ? "" : "s"} Left`;
  return { ok: true as const, slotsLeft, isFull, label, slots };
}
