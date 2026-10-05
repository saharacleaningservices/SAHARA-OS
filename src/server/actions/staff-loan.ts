"use server";

// Staff loans (separate from salary) and Auto Fare are part of the ONE Money
// Khata. New entries go through recordStaffTransaction (Khata → Add entry);
// mistakes are fixed with correctStaffEntry (Old → New → Reason audit).
// Nothing is ever deleted — the old soft-delete actions are retired.

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";
import { recordStaffTransaction } from "@/server/actions/staff-money";

/** Retired (owner QA 05-Oct-2026): loans and recoveries are recorded only in the Khata ledger. */
export async function addLoanEntry() {
  return { error: "Advances and loans are recorded in the Money Khata (Staff → Money Khata → Add entry)." };
}

/** Retired 06-Oct-2026: no silent delete — use Money Khata → Ledger → Correct (reason required). */
export async function removeLoanEntry(_id: string) {
  void _id;
  return { error: "Entries are never deleted. Use Money Khata → Ledger → Correct and give a reason." };
}

export async function getLoanEntries(staffId: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return [];
  return db.staffLoanEntry.findMany({ where: { staffId, deletedAt: null }, orderBy: { date: "desc" }, take: 100 });
}

/** Auto fare — Kaleem (SCS-0004) only; same path, checks and audit as every Khata entry. */
export async function addAutoFare(values: { staffId: string; amount: number; date: string; description?: string; confirmDuplicate?: boolean }) {
  return recordStaffTransaction({ staffId: values.staffId, type: "AUTO_FARE", amount: values.amount, date: values.date, note: values.description || undefined, confirmDuplicate: values.confirmDuplicate });
}

/** Retired 06-Oct-2026: no silent delete — use Money Khata → Ledger → Correct (reason required). */
export async function removeAutoFare(_id: string) {
  void _id;
  return { error: "Entries are never deleted. Use Money Khata → Ledger → Correct and give a reason." };
}
