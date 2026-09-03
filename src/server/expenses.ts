import { db } from "@/lib/db";

export async function getAllExpensesForList() {
  return db.expense.findMany({
    orderBy: { date: "desc" },
    include: { staff: { select: { name: true } }, job: { select: { jobNumber: true } } },
  });
}
