import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { SERVICE_LABELS } from "@/lib/constants";

const SERVICES = ["HOME_DEEP_CLEANING", "COMMERCIAL_CLEANING", "INTERIOR_PAINTING", "PEST_CONTROL"] as const;

/**
 * Per-service monthly analytics — leads, bookings (jobs), collected revenue
 * and lead→job conversion. Master Prompt v2.0 Phase 10.
 */
export async function getServiceAnalytics(year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = endOfMonth(start);

  const rows = await Promise.all(
    SERVICES.map(async (svc) => {
      const [leads, bookings, revenueAgg] = await Promise.all([
        db.lead.count({ where: { deletedAt: null, service: svc, createdAt: { gte: start, lte: end } } }),
        db.job.count({ where: { deletedAt: null, service: svc, createdAt: { gte: start, lte: end } } }),
        db.payment.aggregate({
          where: {
            deletedAt: null,
            paidDate: { gte: start, lte: end },
            job: { service: svc },
          },
          _sum: { paidAmount: true },
        }),
      ]);
      const revenue = revenueAgg._sum.paidAmount ?? 0;
      const conversion = leads > 0 ? Math.round((bookings / leads) * 100) : 0;
      return { key: svc, label: SERVICE_LABELS[svc] ?? svc, leads, bookings, revenue, conversion };
    }),
  );

  return {
    year: y,
    month: m,
    rows,
    totals: {
      leads: rows.reduce((s, r) => s + r.leads, 0),
      bookings: rows.reduce((s, r) => s + r.bookings, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
    },
  };
}
