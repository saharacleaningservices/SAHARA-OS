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
