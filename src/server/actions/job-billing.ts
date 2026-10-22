"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canEditBilling } from "@/lib/permissions";
import { canAccessJob, getOwnStaffId } from "@/server/jobs";
import { isValidGstin, rebillJob } from "@/lib/invoice-tax";

const billingSchema = z.object({
  discountMode: z.enum(["FLAT", "PERCENT"]).default("FLAT"),
  discountValue: z.coerce.number().min(0, "Discount cannot be negative").max(10_000_000).default(0),
  gstEnabled: z.boolean().default(false),
  customerGstin: z.string().trim().toUpperCase().max(15).optional().nullable(),
});

/**
 * Set a job's discount (flat ₹ or %) and the 18% GST toggle (+ customer GSTIN for B2B). Admin, Accounts and Operations
 * share this permission (owner 2026-10-22) with no discount cap. Re-bills jobValue = (subtotal − discount) + GST and keeps
 * an audit line. Payment status is untouched (tracked separately); the balance simply follows the new total.
 */
export async function updateJobBilling(jobId: string, values: unknown) {
  const session = await getSession();
  if (!session || !canEditBilling(session.role)) return { error: "Not authorized", success: false as const };
  const parsed = billingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid billing values", success: false as const };
  const v = parsed.data;
  if (v.gstEnabled && !isValidGstin(v.customerGstin)) return { error: "Enter the customer's 15-character GSTIN to apply GST", success: false as const };
  if (v.discountMode === "PERCENT" && v.discountValue > 100) return { error: "Discount cannot exceed 100%", success: false as const };

  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: { id: true, status: true, jobValue: true, gstAmount: true, discountAmount: true, scheduledDate: true, supervisorId: true, assignments: { select: { staffId: true } } },
  });
  if (!job) return { error: "Job not found", success: false as const };
  if (job.status === "CANCELLED") return { error: "A cancelled booking cannot be re-billed", success: false as const };
  if (session.role === "OPERATIONS") {
    const own = await getOwnStaffId(session.sub);
    if (!canAccessJob(session, job, own)) return { error: "Not authorized", success: false as const };
  }

  const oldTotal = job.jobValue;
  const t = rebillJob(job, { discount: v.discountValue > 0 ? { mode: v.discountMode, value: v.discountValue } : null, gstEnabled: v.gstEnabled });
  await db.job.update({
    where: { id: jobId },
    data: {
      jobValue: t.total,
      discountAmount: t.discount > 0 ? t.discount : null,
      discountMode: t.discount > 0 ? v.discountMode : null,
      discountValue: t.discount > 0 ? v.discountValue : null,
      gstEnabled: v.gstEnabled,
      gstAmount: t.gst,
      customerGstin: v.gstEnabled ? v.customerGstin!.trim().toUpperCase() : null,
    },
  });
  // Keep the money records in step: a single un-split payment row that carried the old total follows the new total, and a
  // generated invoice picks up the GST/discount. Several payment rows (advance + balance) are left for Accounts to review.
  const payments = await db.payment.findMany({ where: { jobId, deletedAt: null }, select: { id: true, amount: true, paidAmount: true } });
  let paymentsReview = false;
  if (payments.length === 1 && Math.abs(payments[0].amount - oldTotal) < 0.01) {
    const p = payments[0];
    await db.payment.update({ where: { id: p.id }, data: { amount: t.total, status: p.paidAmount >= t.total && t.total > 0 ? "PAID" : undefined } });
  } else if (payments.length > 1) paymentsReview = true;
  const invoice = await db.invoice.findUnique({ where: { jobId }, select: { id: true } });
  if (invoice) {
    await db.invoice.update({ where: { id: invoice.id }, data: { totalAmount: t.total, gstPercent: t.gst > 0 ? 18 : 0, gstAmount: t.gst, discount: t.discount, subTotal: t.subtotal } });
  }
  await db.activityLog.create({
    data: {
      jobId,
      actorId: session.sub,
      action: `Billing updated: discount ₹${t.discount}${v.discountMode === "PERCENT" && t.discount > 0 ? ` (${v.discountValue}%)` : ""}, GST ${v.gstEnabled ? `18% ₹${t.gst}` : "off"}, total ₹${t.total}`,
    },
  }).catch(() => {});
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, total: t.total, gst: t.gst, discount: t.discount, paymentsReview };
}
