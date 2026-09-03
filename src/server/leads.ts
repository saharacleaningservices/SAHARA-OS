import { db } from "@/lib/db";

export async function getAllLeadsForList() {
  return db.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedStaff: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { jobs: true } },
    },
  });
}

export async function getLeadDetail(id: string) {
  return db.lead.findUnique({
    where: { id },
    include: {
      assignedStaff: true,
      assignedTo: true,
      createdBy: true,
      quotations: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { dueDate: "desc" } },
      activityLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}
