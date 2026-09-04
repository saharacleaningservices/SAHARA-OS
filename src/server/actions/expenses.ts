"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { expenseSchema } from "@/lib/validation";

export async function createExpense(values: unknown) {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();

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
  if (!session) return { error: "Not authorized" };
  await db.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: true };
}
