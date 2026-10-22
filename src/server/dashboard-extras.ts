import { subDays } from "date-fns";
import { db } from "@/lib/db";

// Small read-only summaries for the role dashboards (2026-10-22). Callers decide who may see them:
// invoice money -> ADMIN / ACCOUNTS only; the conversion summary is counts only (safe for Operations).

export const BOOKED_STAGES = ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"] as const;

/** Lead -> booking conversion over the last `days` days: leads created, of those how many reached a booked stage. */
export async function getLeadToBookingConversion(days = 30) {
  const since = subDays(new Date(), days);
  const [created, booked, cancelled] = await Promise.all([
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: since } } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: since }, stage: { in: [...BOOKED_STAGES] as never } } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: since }, stage: "CANCELLED" as never } }),
  ]);
  return { days, created, booked, cancelled, open: Math.max(created - booked - cancelled, 0), ratePercent: conversionRate(booked, created) };
}

export function conversionRate(booked: number, created: number): number {
  return created > 0 ? Math.round((booked / created) * 100) : 0;
}

/** Invoice status for the Finance tab (money — ADMIN / ACCOUNTS only). Cancelled invoices are left out of the totals. */
export async function getInvoiceStatusSummary() {
  const rows = await db.invoice.groupBy({ by: ["status"], _count: { _all: true }, _sum: { totalAmount: true } });
  const by = (s: string) => rows.find((r) => r.status === s);
  const pick = (s: string) => ({ count: by(s)?._count._all ?? 0, amount: by(s)?._sum.totalAmount ?? 0 });
  return { draft: pick("DRAFT"), issued: pick("ISSUED"), partiallyPaid: pick("PARTIALLY_PAID"), paid: pick("PAID"), cancelled: pick("CANCELLED") };
}
