"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { notifyStaff, dayHref } from "@/server/staff-notify";

function bump(staffId: string) {
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/attendance");
}

export async function addAdvance(staffId: string, amount: number, reason: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!amount || amount <= 0) return { error: "Enter a valid amount" };

  const row = await db.advance.create({ data: { staffId, amount, reason: reason || null, givenByName: session.name } });
  await notifyStaff([staffId], {
    kind: "STAFF_ADVANCE",
    title: `Advance recorded: ${formatINR(amount)}`,
    body: reason || undefined,
    href: dayHref(row.givenAt, `adv-${row.id}`),
    recordId: row.id,
  });
  bump(staffId);
  return { success: true as const };
}

export async function addFine(staffId: string, type: string, amount: number, notes: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!type) return { error: "Pick a fine type" };

  const row = await db.fineRecord.create({ data: { staffId, type, amount: amount || 0, notes: notes || null, recordedByName: session.name } });
  await notifyStaff([staffId], {
    kind: "STAFF_FINE",
    title: `Debit/Fine: ${type}${amount ? ` · ${formatINR(amount)}` : ""}`,
    body: notes || undefined,
    href: dayHref(row.date, `fine-${row.id}`),
    recordId: row.id,
  });
  bump(staffId);
  return { success: true as const };
}

export async function addReward(staffId: string, type: string, amount: number, notes: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  if (!type) return { error: "Pick a reward type" };

  const row = await db.rewardRecord.create({ data: { staffId, type, amount: amount || 0, notes: notes || null, recordedByName: session.name } });
  await notifyStaff([staffId], {
    kind: "STAFF_REWARD",
    title: `Reward: ${type}${amount ? ` · ${formatINR(amount)}` : ""}`,
    body: notes || undefined,
    href: dayHref(row.date, `reward-${row.id}`),
    recordId: row.id,
  });
  bump(staffId);
  return { success: true as const };
}
