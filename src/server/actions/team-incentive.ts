"use server";

// ₹50 TEAM incentive (owner rule, 2026-10-04 scope lock): ONE total amount
// recorded against one eligible Job + the team that was assigned to it.
// Never split automatically between individual staff, never written to any
// individual's payroll/RewardRecord, and never conditional on a Google
// review or star rating. Staff see it in the Staff App as their team's
// incentive for that job; the office decides how it is used.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageStaffFinancials } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { TEAM_INCENTIVE_AMOUNT } from "@/lib/constants";
import { freezeJobTeam } from "@/server/job-team";
import { notifyStaff, dayHref } from "@/server/staff-notify";

export async function recordTeamIncentive(jobId: string, notes?: string) {
  const session = await getSession();
  if (!session || !canManageStaffFinancials(session.role)) return { error: "Not authorized" };

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { id: true, jobNumber: true, status: true, deletedAt: true, completedAt: true, scheduledDate: true, teamSnapshot: true },
  });
  if (!job || job.deletedAt) return { error: "Job not found" };
  if (job.status !== "COMPLETED") return { error: "Team incentive can be recorded only for a completed job" };
  if (await db.teamIncentive.findUnique({ where: { jobId } })) return { error: "Team incentive already recorded for this job" };

  if (!job.teamSnapshot) await freezeJobTeam(jobId);
  const fresh = await db.job.findUnique({ where: { id: jobId }, select: { teamSnapshot: true } });
  const team = (fresh?.teamSnapshot ? JSON.parse(fresh.teamSnapshot) : []) as { staffId: string; name: string; isLead?: boolean }[];
  if (team.length === 0) return { error: "No team is assigned to this job" };

  const date = job.completedAt ?? job.scheduledDate;
  const incentive = await db.teamIncentive.create({
    data: {
      jobId,
      amount: TEAM_INCENTIVE_AMOUNT,
      teamSnapshot: JSON.stringify(team.map(({ staffId, name, isLead }) => ({ staffId, name, isLead: Boolean(isLead) }))),
      notes: notes?.trim() || null,
      date,
      recordedByName: session.name,
    },
  });

  await db.auditLog
    .create({
      data: {
        entityType: "TeamIncentive",
        entityId: incentive.id,
        action: "TEAM_INCENTIVE_RECORDED",
        summary: `Team incentive ${formatINR(TEAM_INCENTIVE_AMOUNT)} (team total) for job ${job.jobNumber}: ${team.map((m) => m.name).join(", ")}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});

  await notifyStaff(
    team.map((m) => m.staffId),
    {
      kind: "STAFF_REWARD",
      title: `Team incentive ${formatINR(TEAM_INCENTIVE_AMOUNT)} — job ${job.jobNumber}`,
      body: `Recorded for your ${team.length}-member team (team total)`,
      href: dayHref(date, `ti-${incentive.id}`),
      recordId: incentive.id,
    },
  );

  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

/** Reverse a mistaken team incentive (Super Admin only) — audited. */
export async function cancelTeamIncentive(jobId: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only the Super Admin can reverse a team incentive" };
  const inc = await db.teamIncentive.findUnique({ where: { jobId } });
  if (!inc) return { error: "No team incentive on this job" };
  await db.teamIncentive.delete({ where: { id: inc.id } });
  await db.auditLog
    .create({
      data: {
        entityType: "TeamIncentive",
        entityId: inc.id,
        action: "TEAM_INCENTIVE_REVERSED",
        summary: `Team incentive ${formatINR(inc.amount)} reversed for job ${jobId}. Team was: ${inc.teamSnapshot}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}
