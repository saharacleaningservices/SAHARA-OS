"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sanitizeChangeRequest } from "@/lib/public-input";

// Customer actions on the public /booking/<token> page. The unguessable token
// is the only credential; each action only records the customer's choice —
// no payment is ever marked as received here.

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;

/** Per-IP and per-booking throttle for the public booking-page actions (skipped outside an HTTP request). */
async function throttled(token: string) {
  let ip: string;
  try {
    ip = clientIp(await headers());
  } catch {
    return false;
  }
  return !rateLimit(`bookpage:ip:${ip}`, 30, 600).allowed || !rateLimit(`bookpage:tok:${token}`, 10, 600).allowed;
}

export async function choosePayAfterService(token: string) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { error: "Invalid booking link" };
  if (await throttled(token)) return { error: "Too many requests — please try again in a few minutes." };
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
export async function requestBookingChange(token: string, kind: keyof typeof CHANGE_LABEL, rawNote: string, rawPreferredDate?: string) {
  if (typeof token !== "string" || !TOKEN_RE.test(token) || typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(CHANGE_LABEL, kind)) return { error: "Invalid request" };
  if (await throttled(token)) return { error: "Too many requests — please try again in a few minutes." };
  const { note, preferredDate } = sanitizeChangeRequest(rawNote, rawPreferredDate);
  const job = await db.job.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { id: true, jobNumber: true, leadId: true, customerName: true, status: true },
  });
  if (!job) return { error: "Booking not found" };
  if (job.status === "CANCELLED" || job.status === "COMPLETED") return { error: "This booking can no longer be changed online — please call us." };

  const label = CHANGE_LABEL[kind];
  const text = `Customer requested ${label}${preferredDate ? ` (preferred: ${preferredDate})` : ""}${note ? ` — "${note}"` : ""}`;
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
