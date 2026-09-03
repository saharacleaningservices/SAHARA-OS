import { db } from "@/lib/db";

export async function getAllPaymentsForList() {
  return db.payment.findMany({
    orderBy: { dueDate: "asc" },
    include: { job: { select: { jobNumber: true } } },
  });
}
