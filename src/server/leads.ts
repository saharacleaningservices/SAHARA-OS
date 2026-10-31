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
export function supervisorLeadWhere() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowEnd = endOfDay(addDays(now, 1));
  return {
    OR: [
      { followUpDate: { gte: todayStart, lte: tomorrowEnd } },
      { serviceDate: { gte: todayStart, lte: tomorrowEnd } },
      { createdAt: { gte: todayStart }, stage: { notIn: ["COMPLETED", "CANCELLED"] as never } },
    ],
  };
}

// Open enquiry stages (used by dashboard counters).
export const OPEN_LEAD_STAGES = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"];

/**
 * Francis (OPERATIONS) — strict 3-day window (owner rule 2026-10-31): a lead is
 * visible only when its service date, follow-up date or creation date falls
 * on yesterday, today or tomorrow. Same window as his job list
 * (jobScopeFor → YESTERDAY_TODAY_TOMORROW). No older/open backlog, no
 * "assigned to me" exception. All three columns are indexed range filters.
 */
export function operationsLeadWindow(now = new Date()) {
  return { from: startOfDay(addDays(now, -1)), to: endOfDay(addDays(now, 1)) };
}

export function operationsLeadWhere(_userId?: string) {
  const { from, to } = operationsLeadWindow();
  return {
    OR: [
      { serviceDate: { gte: from, lte: to } },
      { followUpDate: { gte: from, lte: to } },
      { createdAt: { gte: from, lte: to } },
    ],
  };
}

/** List-query scope for field roles (SUPERVISOR / OPERATIONS); {} for everyone else. */
export function fieldLeadWhere(session?: Pick<SessionPayload, "role" | "sub"> | null) {
  if (session?.role === "SUPERVISOR") return supervisorLeadWhere();
  if (session?.role === "OPERATIONS") return operationsLeadWhere(session.sub);
  return {};
}

/** True if this lead is one SUPERVISOR should be able to see/edit at all — evaluated in JS against a single already-fetched lead (e.g. for a direct-URL detail-page check), matching the same window supervisorLeadWhere() applies at the list-query level. */
export function canAccessLead(
  session: SessionPayload,
  lead: { followUpDate: Date | null; serviceDate: Date | null; createdAt: Date; stage: string; assignedToId?: string | null; createdById?: string | null },
): boolean {
  if (session.role === "OPERATIONS") {
    const { from, to } = operationsLeadWindow();
    const inWin = (d: Date | null) => !!d && d >= from && d <= to;
    return inWin(lead.serviceDate) || inWin(lead.followUpDate) || inWin(lead.createdAt);
  }
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
  Object.assign(where, fieldLeadWhere(session));

  const leads = await db.lead.findMany({
    where,
    orderBy: { leadNumber: "desc" }, // newest Lead ID first (LD-2026-0256, 0255, …)
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

/** Francis's dashboard "New Leads" card: open NEW enquiries + leads assigned to him. */
export async function getNewLeadsForDashboard(userId: string) {
  // Francis's Operations home: NEW enquiries and leads assigned to him — inside his strict yesterday→tomorrow window only.
  const windowWhere = operationsLeadWhere(userId);
  const rows = await db.lead.findMany({
    where: { deletedAt: null, AND: [windowWhere, { OR: [{ stage: "NEW" }, { assignedToId: userId, stage: { in: OPEN_LEAD_STAGES as never } }] }] },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, leadNumber: true, name: true, service: true, area: true, stage: true, createdAt: true, serviceDate: true, timeSlot: true, assignedToId: true, packageName: true },
  });
  const newCount = await db.lead.count({ where: { deletedAt: null, stage: "NEW", AND: [windowWhere] } });
  return { rows: rows.map((r) => ({ ...r, assignedToMe: r.assignedToId === userId })), newCount };
}
