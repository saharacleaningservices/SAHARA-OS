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
