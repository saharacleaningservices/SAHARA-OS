"use server";

// Staff loans (separate from salary). Super Admin + Accounts only. Rows are
// never hard-deleted — removal is a soft-delete with name + time (audit trail).
// A repayment "cut from salary" also reduces Salary Due (server/staff-balance.ts).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyStaff } from "@/server/staff-notify";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";


/** Retired (owner QA 05-Oct-2026): loans and recoveries are recorded only in the Khata ledger. */
export async function addLoanEntry() {
  return { error: "Advances and loans are recorded in the Khata ledger (Staff → Khata ledger → Add payment)." };
}

export async function removeLoanEntry(id: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  const row = await db.staffLoanEntry.findUnique({ where: { id } });
  if (!row || row.deletedAt) return { error: "Entry not found" };
  if (row.source === "KHATABOOK") return { error: "Imported Khata Book entries can only be undone by rolling back the import batch." };
  await db.staffLoanEntry.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: session.name } });
  revalidatePath(`/staff/${row.staffId}`);
  return { ok: true };
}

export async function getLoanEntries(staffId: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return [];
  return db.staffLoanEntry.findMany({ where: { staffId, deletedAt: null }, orderBy: { date: "desc" }, take: 100 });
}

const fareSchema = z.object({
  staffId: z.string().min(1),
  amount: z.number().positive().max(100_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(300).optional(),
});

/** Auto fare owed to the worker — its own ledger line (kind AUTO_FARE), part of Salary Due, shown separately. */
export async function addAutoFare(values: unknown) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  const parsed = fareSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid auto fare" };
  const { staffId, amount, date, description } = parsed.data;
  const fare = await db.staffLedgerEntry.create({
    data: { staffId, date: new Date(`${date}T12:00:00+05:30`), kind: "AUTO_FARE", amount, signedAmount: amount, description: description || "Auto fare", source: "MANUAL", createdByName: session.name },
  });
  await notifyStaff([staffId], { kind: "STAFF_PAYMENT", title: `Auto fare added ₹${amount.toLocaleString("en-IN")}`, body: description || undefined, href: "/my/records?tab=ledger", recordId: fare.id });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/my");
  return { ok: true };
}

export async function removeAutoFare(id: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  const row = await db.staffLedgerEntry.findUnique({ where: { id } });
  if (!row || row.deletedAt || row.kind !== "AUTO_FARE") return { error: "Entry not found" };
  if (row.source === "KHATABOOK") return { error: "Imported Khata Book entries can only be undone by rolling back the import batch." };
  await db.staffLedgerEntry.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: session.name } });
  revalidatePath(`/staff/${row.staffId}`);
  return { ok: true };
}
