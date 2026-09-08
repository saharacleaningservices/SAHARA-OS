import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";

export async function getAllPaymentsForList() {
  const payments = await db.payment.findMany({
    where: { deletedAt: null },
    orderBy: { dueDate: "asc" },
    include: {
      job: { select: { jobNumber: true, service: true, packageName: true, serviceVariant: true, customerMobile: true } },
      lead: { select: { leadNumber: true, service: true, packageName: true, serviceVariant: true, mobile: true } },
    },
  });

  return payments.map((p) => {
    const svc = p.job?.service ?? p.lead?.service ?? null;
    return {
      ...p,
      serviceLabel: svc ? SERVICE_LABELS[svc] ?? svc : null,
      serviceVariant: p.job?.serviceVariant ?? p.lead?.serviceVariant ?? null,
      packageName: p.job?.packageName ?? p.lead?.packageName ?? null,
      refNumber: p.job?.jobNumber ?? p.lead?.leadNumber ?? p.invoiceNumber,
      clientMobile: p.clientMobile ?? p.job?.customerMobile ?? p.lead?.mobile ?? null,
    };
  });
}
