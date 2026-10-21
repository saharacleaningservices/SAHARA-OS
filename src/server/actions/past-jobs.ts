"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { todayIST } from "@/lib/pricing-master";
import { isClosable } from "@/server/past-jobs-cleanup";
import { freezeJobTeam } from "@/server/job-team";

// Admin-only: marks the ticked past-dated, fully-paid jobs as Completed. Every job is re-checked on the server (the
// browser's list is never trusted). It deliberately does NOT send any customer message, create invoices or raise
// alerts — these are old jobs being tidied, not new completions. Each change is written to the job's activity log and
// the audit log, so history stays intact.

const input = z.array(z.string().min(5).max(40)).min(1).max(200);

export async function closePastPaidJobs(ids: unknown) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Only Admin can close jobs in bulk", success: false as const };
  const parsed = input.safeParse(ids);
  if (!parsed.success) return { error: "Select between 1 and 200 jobs", success: false as const };

  const today = todayIST();
  let closed = 0;
  let skipped = 0;
  for (const id of parsed.data) {
    const job = await db.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true, status: true, deletedAt: true, scheduledDate: true, payments: { where: { deletedAt: null }, select: { status: true, amount: true, paidAmount: true } } },
    });
    if (!job || !isClosable({ status: job.status, deleted: Boolean(job.deletedAt), scheduledDate: job.scheduledDate }, job.payments, today)) { skipped++; continue; }
    await db.job.update({ where: { id }, data: { status: "COMPLETED", completedAt: job.scheduledDate } });
    await db.activityLog.create({ data: { jobId: id, actorId: session.sub, action: `Closed in bulk cleanup — service date passed and fully paid (was ${job.status.replaceAll("_", " ")})` } }).catch(() => {});
    await freezeJobTeam(id).catch(() => {});
    closed++;
  }
  await db.auditLog
    .create({ data: { entityType: "Job", entityId: "bulk-cleanup", action: "PAST_JOBS_CLOSED", summary: `${session.name} closed ${closed} past-dated paid job(s)${skipped ? `, ${skipped} skipped` : ""}`, actorName: session.name, actorEmail: session.email } })
    .catch(() => {});
  revalidatePath("/jobs");
  revalidatePath("/admin/past-jobs");
  revalidatePath("/dashboard");
  return { success: true as const, closed, skipped };
}
