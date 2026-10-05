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

const schema = z.object({
  staffId: z.string().min(1),
  kind: z.enum(["LOAN_GIVEN", "LOAN_REPAID"]),
  amount: z.number().positive().max(10_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromSalary: z.boolean().default(false),
  description: z.string().trim().max(300).optional(),
});

export async function addLoanEntry(values: unknown) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid loan entry" };
  const { staffId, kind, amount, date, fromSalary, description } = parsed.data;
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { id: true } });
  if (!staff) return { error: "Staff not found" };
  if (kind === "LOAN_REPAID") {
    const out = await db.staffLoanEntry.aggregate({ where: { staffId, deletedAt: null }, _sum: { signedAmount: true } });
    if (amount > (out._sum.signedAmount ?? 0) + 0.001) return { error: "Repayment is more than the loan remaining." };
  }
  await db.staffLoanEntry.create({
    data: {
      staffId,
      date: new Date(`${date}T12:00:00+05:30`),
      kind,
      amount,
      signedAmount: kind === "LOAN_GIVEN" ? amount : -amount,
      fromSalary: kind === "LOAN_REPAID" ? fromSalary : false,
      description: description || (kind === "LOAN_GIVEN" ? "Loan given" : fromSalary ? "Loan cut from salary" : "Loan repaid"),
      source: "MANUAL",
      createdByName: session.name,
    },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/my");
  revalidatePath("/my/records");
  return { ok: true };
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
