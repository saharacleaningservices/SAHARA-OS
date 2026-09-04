"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAllocateResources } from "@/lib/permissions";

export async function createVehicle(values: { name: string; plateNumber: string; type?: string }) {
  const session = await getSession();
  if (!session || !canAllocateResources(session.role)) return { error: "Not authorized" };
  if (!values.name.trim() || !values.plateNumber.trim()) {
    return { error: "Name and plate number are required" };
  }
  try {
    await db.vehicle.create({
      data: { name: values.name.trim(), plateNumber: values.plateNumber.trim().toUpperCase(), type: values.type?.trim() || null },
    });
  } catch {
    return { error: "A vehicle with that plate number already exists" };
  }
  revalidatePath("/vehicles");
  return { success: true as const };
}

export async function setVehicleActive(id: string, isActive: boolean) {
  const session = await getSession();
  if (!session || !canAllocateResources(session.role)) return { error: "Not authorized" };
  await db.vehicle.update({ where: { id }, data: { isActive } });
  revalidatePath("/vehicles");
  return { success: true as const };
}
