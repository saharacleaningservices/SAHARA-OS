"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export type TeamRoster = { team: number; crew: { id: string; name: string }[] };

/**
 * Who usually works in Team 1-4, for the Confirm Booking pop-up: the crew of each team's most recent job (last 60 days, not cancelled),
 * active staff only, lead first. Names only - no phone, wage or money. Office roles only; never Field Staff.
 */
export async function getTeamRosters(): Promise<TeamRoster[]> {
  const session = await getSession();
  const empty = [1, 2, 3, 4].map((team) => ({ team, crew: [] as { id: string; name: string }[] }));
  if (!session || session.role === "STAFF") return empty;
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000);
  const jobs = await db.job.findMany({
    where: { deletedAt: null, teamNumber: { in: [1, 2, 3, 4] }, status: { not: "CANCELLED" }, scheduledDate: { gte: since } },
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    take: 80,
    select: { teamNumber: true, assignments: { select: { isLead: true, staff: { select: { id: true, name: true, isActive: true } } } } },
  });
  return empty.map((e) => {
    const job = jobs.find((j) => j.teamNumber === e.team && j.assignments.some((a) => a.staff.isActive));
    const crew = (job?.assignments ?? [])
      .filter((a) => a.staff.isActive)
      .sort((a, b) => Number(b.isLead) - Number(a.isLead))
      .map((a) => ({ id: a.staff.id, name: a.staff.name }));
    return { team: e.team, crew };
  });
}
