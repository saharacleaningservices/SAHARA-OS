"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// Customer actions on the public /booking/<token> page. The unguessable token
// is the only credential; each action only records the customer's choice —
// no payment is ever marked as received here.

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;

export async function choosePayAfterService(token: string) {
  if (!TOKEN_RE.test(token)) return { error: "Invalid booking link" };
  const job = await db.job.findFirst({ where: { publicToken: token, deletedAt: null }, select: { id: true, status: true } });
  if (!job) return { error: "Booking not found" };
  if (job.status === "CANCELLED" || job.status === "COMPLETED") return { error: "This booking can no longer be changed" };
  await db.job.update({ where: { id: job.id }, data: { paymentPreference: "PAY_AFTER_SERVICE" } });
  await db.activityLog.create({ data: { jobId: job.id, action: "Customer chose Pay After Service (booking page)" } }).catch(() => {});
  revalidatePath(`/booking/${token}`);
  return { success: true as const };
}

const CHANGE_LABEL = { RESCHEDULE: "reschedule", POSTPONE: "postponement", CANCEL: "cancellation" } as const;

/**
 * Customer asks to reschedule / postpone / cancel from the booking page.
 * Records a REQUEST for the office (activity log, lead timeline, high-priority
 * follow-up, staff alert) — the job itself is never changed here.
 */
export async function requestBookingChange(token: string, kind: keyof typeof CHANGE_LABEL, note: string, preferredDate?: string) {
  if (!TOKEN_RE.test(token) || !(kind in CHANGE_LABEL)) return { error: "Invalid request" };
  const job = await db.job.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { id: true, jobNumber: true, leadId: true, customerName: true, status: true },
  });
  if (!job) return { error: "Booking not found" };
  if (job.status === "CANCELLED" || job.status === "COMPLETED") return { error: "This booking can no longer be changed online — please call us." };

  const label = CHANGE_LABEL[kind];
  const text = `Customer requested ${label}${preferredDate ? ` (preferred: ${preferredDate})` : ""}${note.trim() ? ` — "${note.trim().slice(0, 300)}"` : ""}`;
  const recent = await db.activityLog.findFirst({
    where: { jobId: job.id, action: { startsWith: `Customer requested ${label}` }, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent) return { success: true as const, duplicate: true };

  await db.activityLog.create({ data: { jobId: job.id, action: `${text} (booking page) — awaiting office confirmation` } });
  if (job.leadId) {
    const { addTimelineEntry } = await import("@/server/timeline");
    await addTimelineEntry({ leadId: job.leadId, type: "NOTE", body: `${job.jobNumber}: ${text}. Awaiting office confirmation.` }).catch(() => {});
    await db.followUp
      .create({ data: { leadId: job.leadId, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "CALL", priority: "HIGH", notes: `${job.jobNumber}: customer requested ${label}` } })
      .catch(() => {});
  }
  const { notify } = await import("@/server/notify");
  await notify({ kind: "NEW_BOOKING", title: `Booking ${label} request — ${job.customerName}`, body: `${job.jobNumber} · ${text}`, href: `/jobs/${job.id}` }).catch(() => {});
  return { success: true as const };
}
