"use server";

import { getSession } from "@/lib/session";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

/** Owner Command Center — monthly business revenue target (ADMIN-editable). */
export async function getBusinessTarget(year: number, month: number) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return null as never;
  }
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
