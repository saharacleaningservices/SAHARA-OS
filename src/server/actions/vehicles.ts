"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAllocateResources } from "@/lib/permissions";

type VehicleInput = {
  name: string;
  plateNumber: string;
  type?: string;
  currentKm?: string | number;
  lastServiceDate?: string;
  nextServiceDate?: string;
};

function vehicleFields(values: VehicleInput) {
  const km =
    values.currentKm === "" || values.currentKm === undefined || values.currentKm === null
      ? null
      : Math.round(Number(values.currentKm));
  return {
    type: values.type?.trim() || null,
    currentKm: Number.isFinite(km as number) ? km : null,
    lastServiceDate: values.lastServiceDate ? new Date(values.lastServiceDate) : null,
    nextServiceDate: values.nextServiceDate ? new Date(values.nextServiceDate) : null,
  };
}

export async function createVehicle(values: VehicleInput) {
  const session = await getSession();
  if (!session || !canAllocateResources(session.role)) return { error: "Not authorized" };
  if (!values.name.trim() || !values.plateNumber.trim()) {
    return { error: "Name and plate number are required" };
  }
  try {
    await db.vehicle.create({
      data: {
        name: values.name.trim(),
        plateNumber: values.plateNumber.trim().toUpperCase(),
        ...vehicleFields(values),
      },
    });
  } catch {
    return { error: "A vehicle with that plate number already exists" };
  }
  revalidatePath("/vehicles");
  return { success: true as const };
}

export async function updateVehicle(id: string, values: VehicleInput) {
  const session = await getSession();
  if (!session || !canAllocateResources(session.role)) return { error: "Not authorized" };
  if (!values.name.trim() || !values.plateNumber.trim()) {
    return { error: "Name and plate number are required" };
  }
  try {
    await db.vehicle.update({
      where: { id },
      data: {
        name: values.name.trim(),
        plateNumber: values.plateNumber.trim().toUpperCase(),
        ...vehicleFields(values),
      },
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
