"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { expenseSchema } from "@/lib/validation";
import { softDeleteMany } from "@/server/audit";

/**
 * None of these actions had ANY role check at all before the 2026-09-21
 * Francis policy audit — only page-level nav access (middleware +
 * ROLE_NAV_ACCESS) gated the Expenses module, which stops a restricted
 * role from ever seeing the page but doesn't stop a direct Server Action
 * call. Matches who actually has "expenses" in ROLE_NAV_ACCESS
 * (src/lib/constants.ts): ADMIN, ACCOUNTS, OPERATIONS. SUPERVISOR
 * (Francis) and STAFF are excluded — same as everyone without page access.
 */
function canAccessExpenses(role: string | undefined): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS";
}

export async function createExpense(values: unknown) {
  const session = await getSession();
  if (!canAccessExpenses(session?.role)) return { error: "Not authorized", success: false as const };
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;

  await db.expense.create({
    data: {
      category: data.category,
      description: data.description,
      amount: data.amount,
      date: new Date(data.date),
      paidTo: data.paidTo || null,
      staffId: data.staffId || null,
      jobId: data.jobId || null,
      addedById: session?.sub,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function updateExpense(id: string, values: unknown) {
  const session = await getSession();
  if (!canAccessExpenses(session?.role)) return { error: "Not authorized", success: false as const };
  const parsed = expenseSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const d = parsed.data;
  await db.expense.update({
    where: { id },
    data: {
      ...(d.category && { category: d.category }),
      ...(d.description && { description: d.description }),
      ...(d.amount !== undefined && { amount: d.amount }),
      ...(d.date && { date: new Date(d.date) }),
      ...(d.paidTo !== undefined && { paidTo: d.paidTo || null }),
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function deleteExpense(id: string) {
  const session = await getSession();
  if (!session || !canAccessExpenses(session.role)) return { error: "Not authorized" };
  await softDeleteMany("Expense", [id], session);
  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkDeleteExpenses(ids: string[]) {
  const session = await getSession();
  if (!session || !canAccessExpenses(session.role)) return { error: "Not authorized" };
  const count = await softDeleteMany("Expense", ids, session);
  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: true as const, count };
}
