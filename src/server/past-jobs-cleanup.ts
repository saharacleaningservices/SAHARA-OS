import { db } from "@/lib/db";
import { todayIST } from "@/lib/pricing-master";

// Cleanup of jobs whose service date has passed but were never marked Completed. A job is offered for closing ONLY when
// strong evidence says it was done: the date is in the past, it is still an open status, and EVERY payment on it is paid
// in full. Nothing is changed here — the Admin page lists the candidates and an Admin ticks the ones to close.

const OPEN_STATUSES = ["ASSIGNED", "ON_THE_WAY", "STARTED"] as const;

export type ClosableCandidate = { id: string; jobNumber: string; customerName: string; service: string; date: string; status: string; paid: number };

/** Pure rule, shared by the list and by the action that re-checks every job before closing it. */
export function isClosable(
  job: { status: string; deleted: boolean; scheduledDate: Date },
  payments: { status: string; amount: number; paidAmount: number }[],
  today: string,
): boolean {
  if (job.deleted || !(OPEN_STATUSES as readonly string[]).includes(job.status)) return false;
  if (job.scheduledDate.toISOString().slice(0, 10) >= today) return false;
  if (payments.length === 0) return false; // no payment evidence → never auto-offered
  return payments.every((p) => p.amount > 0 && (p.status === "PAID" || p.paidAmount >= p.amount - 0.01));
}

export async function findClosableJobs(): Promise<ClosableCandidate[]> {
  const today = todayIST();
  const jobs = await db.job.findMany({
    where: { deletedAt: null, status: { in: [...OPEN_STATUSES] }, scheduledDate: { lt: new Date(`${today}T00:00:00Z`) } },
    select: { id: true, jobNumber: true, customerName: true, service: true, status: true, scheduledDate: true, payments: { where: { deletedAt: null }, select: { status: true, amount: true, paidAmount: true } } },
    orderBy: { scheduledDate: "asc" },
    take: 500,
  });
  return jobs
    .filter((j) => isClosable({ status: j.status, deleted: false, scheduledDate: j.scheduledDate }, j.payments, today))
    .map((j) => ({ id: j.id, jobNumber: j.jobNumber, customerName: j.customerName, service: j.service, date: j.scheduledDate.toISOString().slice(0, 10), status: j.status, paid: j.payments.reduce((s, p) => s + p.paidAmount, 0) }));
}
