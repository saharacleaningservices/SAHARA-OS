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
