import { db } from "@/lib/db";

export async function getAllQuotations() {
  return db.quotation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      lead: { select: { leadNumber: true, name: true, mobile: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });
}
