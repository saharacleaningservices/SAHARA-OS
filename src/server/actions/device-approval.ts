"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function approveDevice(deviceId: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only the owner can approve devices" };

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Device not found" };

  await db.device.update({
    where: { id: deviceId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedByName: session.name, otpCode: null, otpExpiresAt: null },
  });

  await db.auditLog.create({
    data: {
      entityType: "Device",
      entityId: deviceId,
      action: "DEVICE_APPROVED",
      summary: `Approved device login (${device.label ?? "unknown device"})`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/device-approvals");
  return { success: true as const };
}

export async function denyDevice(deviceId: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only the owner can deny devices" };

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Device not found" };

  await db.device.update({
    where: { id: deviceId },
    data: { status: "DENIED", otpCode: null, otpExpiresAt: null },
  });

  await db.auditLog.create({
    data: {
      entityType: "Device",
      entityId: deviceId,
      action: "DEVICE_DENIED",
      summary: `Denied device login (${device.label ?? "unknown device"})`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/device-approvals");
  return { success: true as const };
}
