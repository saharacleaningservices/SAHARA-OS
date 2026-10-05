import { differenceInCalendarDays } from "date-fns";

export type PaymentStatusValue = "PENDING" | "DUE_SOON" | "OVERDUE" | "PAID";

/**
 * Payment status is stored in the DB but can go stale as days pass (a
 * PENDING invoice becomes OVERDUE without anyone touching it). This derives
 * the live status for display/filtering — PAID is authoritative once set,
 * everything else is recomputed from the due date every time it's read.
 */
export function computePaymentStatus(dueDate: Date, dbStatus: string): PaymentStatusValue {
  if (dbStatus === "PAID") return "PAID";
  const days = differenceInCalendarDays(dueDate, new Date());
  if (days < 0) return "OVERDUE";
  if (days <= 3) return "DUE_SOON";
  return "PENDING";
}

export function pendingDays(dueDate: Date): number {
  return differenceInCalendarDays(new Date(), dueDate);
}

/**
 * Job-level collection summary shown to Francis and the crew (Job Amount,
 * paid so far, balance, status). Same rule as the CRM job page: paid amounts
 * come only from recorded Payment rows.
 */
export function jobPaymentSummary(jobValue: number, payments: { paidAmount: number | null }[]) {
  const paid = payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const balance = Math.max(jobValue - paid, 0);
  const status = balance <= 0 && paid > 0 ? "Paid" : paid > 0 ? "Partly Paid" : "Pending";
  return { paid, balance, status } as const;
}
