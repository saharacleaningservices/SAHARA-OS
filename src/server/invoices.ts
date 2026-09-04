import { db } from "@/lib/db";

export async function getInvoiceForJob(jobId: string) {
  return db.invoice.findUnique({ where: { jobId } });
}

export async function getInvoiceList() {
  return db.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}
