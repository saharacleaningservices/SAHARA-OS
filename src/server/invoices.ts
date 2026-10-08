import { db } from "@/lib/db";

export async function getInvoiceForJob(jobId: string) {
  return db.invoice.findUnique({ where: { jobId } });
}

export async function getInvoiceList() {
  return db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      job: { select: { jobNumber: true, publicToken: true, status: true } },
      quotation: { select: { quoteNumber: true, leadId: true } },
    },
  });
}

export async function getInvoiceById(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: { job: { select: { jobNumber: true } }, quotation: { select: { quoteNumber: true } } },
  });
}
