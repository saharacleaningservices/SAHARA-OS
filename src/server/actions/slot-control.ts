"use server";

// CRM → Jobs → Slot Availability. Super Admin, Operations and Accounts can
// override the automatic team-capacity availability per date (OPEN / FILLING /
// FULL, team count) and per time slot (OPEN / FULL). Every change is audit-logged.
// The public booking calendar reads the result through server/slot-capacity.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAudit } from "@/server/audit";
import { TIME_SLOTS } from "@/lib/constants";
import { computeSlotAvailability } from "@/server/slot-capacity";

const SLOT_ROLES = new Set(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireSlotManager() {
  const session = await getSession();
  return session && SLOT_ROLES.has(session.role) ? session : null;
}

function refresh() {
  for (const p of ["/jobs/slots", "/booking", "/home-deep-cleaning-pune", "/offers"]) revalidatePath(p);
}

/** Next `days` dates with automatic load and any manual overrides — CRM only. */
export async function getSlotBoard(days = 21) {
  if (!(await requireSlotManager())) return null;
  const n = Math.min(Math.max(Math.floor(days), 1), 45);
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const base = new Date(`${todayIst}T00:00:00+05:30`);
  const dates = Array.from({ length: n }, (_, i) => new Date(base.getTime() + i * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [results, controls] = await Promise.all([
    Promise.all(dates.map((d) => computeSlotAvailability(d))),
    db.bookingSlotControl.findMany({ where: { date: { in: dates } } }),
  ]);
  return dates.map((date, i) => {
    const r = results[i];
    const day = controls.find((c) => c.date === date && c.slot === "*");
    const slotStatus = Object.fromEntries(controls.filter((c) => c.date === date && c.slot !== "*").map((c) => [c.slot, c.status ?? "AUTO"]));
    return {
      date,
      booked: r.ok ? r.booked : 0,
      teams: r.ok ? r.teams : 0,
      dailyCapacity: r.ok ? r.dailyCapacity : 0,
      isFull: r.ok ? r.isFull : true,
      slots: r.ok ? r.slots : [],
      dayStatus: (day?.status ?? "AUTO") as "AUTO" | "OPEN" | "FILLING" | "FULL",
      teamCapacity: day?.teamCapacity ?? null,
      slotStatus: slotStatus as Record<string, "AUTO" | "OPEN" | "FULL">,
      updatedByName: day?.updatedByName ?? null,
    };
  });
}

const daySchema = z.object({
  date: z.string().regex(DATE),
  status: z.enum(["AUTO", "OPEN", "FILLING", "FULL"]),
  teamCapacity: z.number().int().min(0).max(50).nullable(),
});

export async function setDayControl(values: unknown) {
  const session = await requireSlotManager();
  if (!session) return { error: "You don't have permission to change slot availability." };
  const parsed = daySchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid date or status." };
  const { date, status, teamCapacity } = parsed.data;
  if (status === "AUTO" && teamCapacity == null) {
    await db.bookingSlotControl.deleteMany({ where: { date, slot: "*" } });
  } else {
    const data = { status: status === "AUTO" ? null : status, teamCapacity, updatedByName: session.name };
    await db.bookingSlotControl.upsert({ where: { date_slot: { date, slot: "*" } }, create: { date, slot: "*", ...data }, update: data });
  }
  await logAudit({
    entityType: "SlotAvailability",
    entityId: date,
    action: "SLOT_DAY_UPDATE",
    summary: `${date}: day ${status}${teamCapacity != null ? ` · ${teamCapacity} team(s)` : ""}`,
    session,
  });
  refresh();
  return { ok: true };
}

const slotSchema = z.object({
  date: z.string().regex(DATE),
  slot: z.string().refine((s) => (TIME_SLOTS as readonly string[]).includes(s) && s !== "Flexible", "Unknown slot"),
  status: z.enum(["AUTO", "OPEN", "FULL"]),
});

export async function setSlotControl(values: unknown) {
  const session = await requireSlotManager();
  if (!session) return { error: "You don't have permission to change slot availability." };
  const parsed = slotSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid slot." };
  const { date, slot, status } = parsed.data;
  if (status === "AUTO") {
    await db.bookingSlotControl.deleteMany({ where: { date, slot } });
  } else {
    await db.bookingSlotControl.upsert({
      where: { date_slot: { date, slot } },
      create: { date, slot, status, updatedByName: session.name },
      update: { status, updatedByName: session.name },
    });
  }
  await logAudit({ entityType: "SlotAvailability", entityId: `${date} ${slot}`, action: "SLOT_UPDATE", summary: `${date} ${slot}: ${status}`, session });
  refresh();
  return { ok: true };
}
