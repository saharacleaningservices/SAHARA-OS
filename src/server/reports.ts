import { db } from "@/lib/db";

export async function getReportsData() {
  const [jobs, photos, payments, certificates] = await Promise.all([
    db.job.findMany({
      where: { deletedAt: null, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { supervisor: { select: { name: true } }, assignments: { include: { staff: { select: { name: true } } } } },
      take: 200,
    }),
    db.photo.findMany({
      where: { job: { deletedAt: null } },
      orderBy: { uploadedAt: "desc" },
      include: { job: { select: { jobNumber: true, customerName: true } } },
      take: 200,
    }),
    db.payment.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.certificate.findMany({ where: { job: { deletedAt: null } }, orderBy: { issuedDate: "desc" }, take: 200 }),
  ]);

  return { jobs, photos, payments, certificates };
}

export type ReportsData = Awaited<ReturnType<typeof getReportsData>>;
