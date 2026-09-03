import { db } from "@/lib/db";

export async function getAllJobsForList() {
  return db.job.findMany({
    orderBy: { scheduledDate: "desc" },
    include: {
      supervisor: { select: { name: true } },
      assignments: { include: { staff: { select: { name: true } } } },
      payments: { select: { status: true } },
    },
  });
}

export async function getJobDetail(id: string) {
  return db.job.findUnique({
    where: { id },
    include: {
      lead: true,
      supervisor: true,
      assignments: { include: { staff: true } },
      photos: { orderBy: { uploadedAt: "desc" } },
      certificate: true,
      payments: true,
      activityLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
}
