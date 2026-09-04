import { db } from "@/lib/db";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { jobScopeFor } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/session";

/** Resolves the logged-in user's own Staff record id, if they have one. */
export async function getOwnStaffId(userId: string): Promise<string | null> {
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } });
  return staff?.id ?? null;
}

/**
 * Job list, scoped per role:
 * - Operations Manager: today + tomorrow only
 * - Team Leader: jobs they supervise or are assigned to (their own team)
 * - Worker: jobs they're assigned to, today only
 * - Admin / everyone else: unrestricted
 */
export async function getAllJobsForList(session?: SessionPayload) {
  const scope = jobScopeFor(session?.role ?? "ADMIN");
  const now = new Date();

  const where: Record<string, unknown> = { deletedAt: null };

  if (scope === "TODAY_TOMORROW") {
    where.scheduledDate = { gte: startOfDay(now), lte: endOfDay(addDays(now, 1)) };
  } else if (scope === "OWN_TEAM" || scope === "OWN_TODAY") {
    const staffId = session ? await getOwnStaffId(session.sub) : null;
    where.OR = [{ supervisorId: staffId ?? "__none__" }, { assignments: { some: { staffId: staffId ?? "__none__" } } }];
    if (scope === "OWN_TODAY") {
      where.scheduledDate = { gte: startOfDay(now), lte: endOfDay(now) };
    }
  }

  return db.job.findMany({
    where,
    orderBy: { scheduledDate: "desc" },
    include: {
      supervisor: { select: { name: true } },
      assignments: { include: { staff: { select: { name: true } } } },
      payments: { select: { status: true } },
      vehicle: { select: { name: true, plateNumber: true } },
    },
  });
}

export async function getJobDetail(id: string) {
  return db.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      lead: true,
      supervisor: true,
      vehicle: true,
      assignments: { include: { staff: true } },
      photos: { orderBy: { uploadedAt: "desc" } },
      materialIssues: { orderBy: { issuedAt: "desc" } },
      certificate: true,
      payments: true,
      activityLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
}

/** True if the given session is allowed to view/act on this specific job. */
export function canAccessJob(
  session: SessionPayload,
  job: { supervisorId: string | null; assignments: { staffId: string }[] },
  ownStaffId: string | null
): boolean {
  const scope = jobScopeFor(session.role);
  if (scope === "ALL" || scope === "TODAY_TOMORROW") return true;
  if (!ownStaffId) return false;
  return job.supervisorId === ownStaffId || job.assignments.some((a) => a.staffId === ownStaffId);
}
