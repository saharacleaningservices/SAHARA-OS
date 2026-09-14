"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

/** Owner Command Center — monthly business revenue target (ADMIN-editable). */
export async function getBusinessTarget(year: number, month: number) {
  const row = await db.businessTarget.findUnique({
    where: { year_month: { year, month } },
  });
  return row ?? null;
}

export async function setBusinessTarget(year: number, month: number, targetAmount: number) {
  const session = await requireRole(["ADMIN"]);
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return { error: "Enter a valid target amount", success: false as const };
  }

  await db.businessTarget.upsert({
    where: { year_month: { year, month } },
    create: { year, month, targetAmount, setByName: session.name },
    update: { targetAmount, setByName: session.name },
  });

  revalidatePath("/dashboard");
  return { success: true as const };
}
