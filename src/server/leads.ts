import { db } from "@/lib/db";
import { startOfDay, endOfDay, addDays } from "date-fns";
import type { SessionPayload } from "@/lib/session";

/**
 * Francis (SUPERVISOR) final policy, 2026-09-21: "Edit allowed lead/booking
 * operational fields only for TODAY and TOMORROW" and "must NOT have
 * unrestricted access to the Customers database... only the customer
 * information needed for today's/tomorrow's operations and active
 * enquiries." A lead is in scope for SUPERVISOR if it's operationally
 * relevant to today/tomorrow (a follow-up or service date landing in that
 * window) or is a genuinely new/active enquiry (created today, not yet
 * resolved) — mirrors canAccessJob's role-scoping pattern in server/jobs.ts.
 * OPERATIONS (Shoyab) and ADMIN/ACCOUNTS are unrestricted here — this
 * scope applies to SUPERVISOR only.
 */
function supervisorLeadWhere() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowEnd = endOfDay(addDays(now, 1));
  return {
    OR: [
      { followUpDate: { gte: todayStart, lte: tomorrowEnd } },
      { serviceDate: { gte: todayStart, lte: tomorrowEnd } },
      { createdAt: { gte: todayStart }, stage: { notIn: ["COMPLETED", "CANCELLED"] as const } },
    ],
  };
}

/** True if this lead is one SUPERVISOR should be able to see/edit at all — evaluated in JS against a single already-fetched lead (e.g. for a direct-URL detail-page check), matching the same window supervisorLeadWhere() applies at the list-query level. */
export function canAccessLead(
  session: SessionPayload,
  lead: { followUpDate: Date | null; serviceDate: Date | null; createdAt: Date; stage: string },
): boolean {
  if (session.role !== "SUPERVISOR") return true;
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const inWindow = (d: Date | null) => !!d && d >= todayStart && d <= tomorrowEnd;
  if (inWindow(lead.followUpDate) || inWindow(lead.serviceDate)) return true;
  if (lead.createdAt >= todayStart && lead.stage !== "COMPLETED" && lead.stage !== "CANCELLED") return true;
  return false;
}

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

export async function getAllLeadsForList(session?: SessionPayload) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (session?.role === "SUPERVISOR") Object.assign(where, supervisorLeadWhere());

  const leads = await db.lead.findMany({
    where,
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
