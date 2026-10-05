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

/**
 * Retired (owner QA 05-Oct-2026): new advances are recorded only in the Khata
 * ledger (recordStaffTransaction → Advance). Existing Advance rows stay and keep counting.
 */
export async function addAdvance() {
  return { error: "Advances and loans are recorded in the Khata ledger (Staff → Khata ledger → Add payment)." };
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
