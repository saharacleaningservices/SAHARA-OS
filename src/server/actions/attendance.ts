"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkIn, checkOut } from "@/server/attendance";

async function ownStaffId(userId: string) {
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } });
  return staff?.id ?? null;
}

export async function selfCheckIn(gpsLat?: number | null, gpsLng?: number | null) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const staffId = await ownStaffId(session.sub);
  if (!staffId) return { error: "No staff profile linked to this login" };
  await checkIn(staffId, gpsLat, gpsLng);
  revalidatePath("/attendance");
  return { success: true as const };
}

export async function selfCheckOut() {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const staffId = await ownStaffId(session.sub);
  if (!staffId) return { error: "No staff profile linked to this login" };
  await checkOut(staffId);
  revalidatePath("/attendance");
  return { success: true as const };
}

/** Admin/Ops manual check-in/out or correction for any staff member. */
export async function markAttendance(staffId: string, status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE") {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "OPERATIONS")) return { error: "Not authorized" };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const existing = await db.attendance.findFirst({ where: { staffId, date: { gte: start } } });

  if (existing) {
    await db.attendance.update({ where: { id: existing.id }, data: { status } });
  } else {
    await db.attendance.create({ data: { staffId, date: start, status } });
  }
  revalidatePath("/attendance");
  return { success: true as const };
}
