import { db } from "@/lib/db";
import { normalizeMobile } from "@/server/customer-db";

// "Past Service History & Invoices" for the lead page (owner 2026-10-22): every completed job for the lead's customer
// (same mobile, any lead) with its amount and invoice. Money + contact data — callers render it for ADMIN / ACCOUNTS only
// (same rule as the invoice PDF route). Matching mirrors /api/customers/history: last-4 prefilter, then the full
// normalised 10-digit mobile.

export type ServiceHistoryRow = {
  jobId: string;
  jobNumber: string;
  date: Date;
  service: string;
  packageName: string | null;
  amount: number;
  invoice: { id: string; number: string; status: string; total: number } | null;
};

export async function getCustomerServiceHistory(mobile: string | null | undefined, take = 20) {
  const key = normalizeMobile(mobile);
  if (!key) return { rows: [] as ServiceHistoryRow[], totalJobs: 0, totalAmount: 0 };
  const tail = key.slice(-4);
  const jobs = (
    await db.job.findMany({
      where: { customerMobile: { contains: tail }, deletedAt: null, status: "COMPLETED" },
      orderBy: [{ completedAt: "desc" }, { scheduledDate: "desc" }],
      take: 200,
      select: { id: true, jobNumber: true, customerMobile: true, service: true, packageName: true, scheduledDate: true, completedAt: true, jobValue: true },
    })
  ).filter((j) => normalizeMobile(j.customerMobile) === key);
  const invoices = jobs.length
    ? await db.invoice.findMany({
        where: { jobId: { in: jobs.map((j) => j.id) }, status: { not: "CANCELLED" } },
        select: { id: true, invoiceNumber: true, status: true, totalAmount: true, jobId: true },
      })
    : [];
  const invoiceByJob = new Map(invoices.map((i) => [i.jobId as string, i]));
  const all: ServiceHistoryRow[] = jobs.map((j) => {
    const inv = invoiceByJob.get(j.id);
    return {
      jobId: j.id,
      jobNumber: j.jobNumber,
      date: j.completedAt ?? j.scheduledDate,
      service: j.service,
      packageName: j.packageName,
      amount: inv?.totalAmount ?? j.jobValue,
      invoice: inv ? { id: inv.id, number: inv.invoiceNumber, status: inv.status, total: inv.totalAmount } : null,
    };
  });
  return { rows: all.slice(0, take), totalJobs: all.length, totalAmount: all.reduce((s, r) => s + (r.amount || 0), 0) };
}
