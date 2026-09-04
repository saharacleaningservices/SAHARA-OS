import { db } from "@/lib/db";

export async function getAllPaymentsForList() {
  return db.payment.findMany({
    where: { deletedAt: null },
    orderBy: { dueDate: "asc" },
    include: { job: { select: { jobNumber: true } } },
  });
}
