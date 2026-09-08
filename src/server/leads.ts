import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

/** Quick counters shown above the Leads CRM board. */
export async function getLeadsPageStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [todayJobs, todayFollowUps, overdueFollowUps, revToday] = await Promise.all([
    db.job.count({
      where: { deletedAt: null, status: { notIn: ["CANCELLED", "COMPLETED"] }, scheduledDate: { gte: todayStart, lte: todayEnd } },
    }),
    db.followUp.count({ where: { isDone: false, dueDate: { gte: todayStart, lte: todayEnd }, lead: { deletedAt: null } } }),
    db.followUp.count({ where: { isDone: false, dueDate: { lt: todayStart }, lead: { deletedAt: null } } }),
    db.payment.aggregate({ where: { deletedAt: null, paidDate: { gte: todayStart, lte: todayEnd } }, _sum: { paidAmount: true } }),
  ]);

  return {
    todayJobs,
    todayFollowUps,
    overdueFollowUps,
    todayRevenue: revToday._sum.paidAmount ?? 0,
  };
}

export async function getAllLeadsForList() {
  const leads = await db.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assignedStaff: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { jobs: true } },
    },
  });

  // Resolve the multi-staff assignment (JSON id list) to names once.
  const allIds = new Set<string>();
  for (const l of leads) {
    if (l.assignedStaffIds) {
      try {
        for (const id of JSON.parse(l.assignedStaffIds) as string[]) allIds.add(id);
      } catch {
        /* ignore malformed JSON */
      }
    }
  }
  const staff = allIds.size
    ? await db.staff.findMany({ where: { id: { in: [...allIds] } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(staff.map((s) => [s.id, s.name]));

  return leads.map((l) => {
    let ids: string[] = [];
    try {
      ids = l.assignedStaffIds ? (JSON.parse(l.assignedStaffIds) as string[]) : [];
    } catch {
      ids = [];
    }
    const names = ids.map((id) => nameById.get(id)).filter(Boolean) as string[];
    return {
      ...l,
      assignedStaffNames: names.length ? names : l.assignedStaff?.name ? [l.assignedStaff.name] : [],
    };
  });
}

export async function getLeadDetail(id: string) {
  return db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignedStaff: true,
      assignedTo: true,
      createdBy: true,
      quotations: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { dueDate: "asc" } },
      timeline: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}
