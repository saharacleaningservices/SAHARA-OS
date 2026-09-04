"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

function canManageStaffFinancials(role?: string) {
  return role === "ADMIN";
}

export async function addAdvance(staffId: string, amount: number, reason: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!amount || amount <= 0) return { error: "Enter a valid amount" };

  await db.advance.create({ data: { staffId, amount, reason: reason || null, givenByName: session.name } });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/attendance");
  return { success: true as const };
}

export async function addFine(staffId: string, type: string, amount: number, notes: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!type) return { error: "Pick a fine type" };

  await db.fineRecord.create({ data: { staffId, type, amount: amount || 0, notes: notes || null, recordedByName: session.name } });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/attendance");
  return { success: true as const };
}

export async function addReward(staffId: string, type: string, amount: number, notes: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!type) return { error: "Pick a reward type" };

  await db.rewardRecord.create({ data: { staffId, type, amount: amount || 0, notes: notes || null, recordedByName: session.name } });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/attendance");
  return { success: true as const };
}
