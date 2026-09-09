"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** Owner-maintained bank balance shown on the Owner Dashboard. Super Admin only. */
export async function updateBankBalance(amount: number) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Super Admin only" };
  const value = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  await db.companySettings.upsert({
    where: { id: "default" },
    create: { id: "default", bankBalance: value },
    update: { bankBalance: value },
  });
  revalidatePath("/profit");
  return { success: true as const };
}
