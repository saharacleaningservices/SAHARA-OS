import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { getMonthlyLedgerForAllStaff } from "@/server/attendance";
import { ExpenseCategory } from "@/generated/prisma/enums";

const MATERIAL_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.HOUSEKEEPING_MATERIAL,
  ExpenseCategory.EQUIPMENT,
  ExpenseCategory.CHEMICALS,
];

/** Super-Admin-only financial snapshot — Master Prompt v3.1 Owner Dashboard. */
export async function getOwnerSnapshot() {
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const lStart = startOfMonth(subMonths(now, 1));
  const lEnd = endOfMonth(subMonths(now, 1));

  const [
    settings,
    monthCollected,
    lastCollected,
    monthExpenses,
    materialExpenses,
    pendingAgg,
    serviceRows,
    staffLedger,
  ] = await Promise.all([
    db.companySettings.findUnique({ where: { id: "default" } }),
    db.payment.aggregate({ where: { deletedAt: null, paidDate: { gte: mStart, lte: mEnd } }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { deletedAt: null, paidDate: { gte: lStart, lte: lEnd } }, _sum: { paidAmount: true } }),
    db.expense.aggregate({ where: { deletedAt: null, date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
    db.expense.aggregate({
      where: { deletedAt: null, date: { gte: mStart, lte: mEnd }, category: { in: MATERIAL_CATEGORIES } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { deletedAt: null, status: { in: ["PENDING", "DUE_SOON", "OVERDUE"] } },
      _sum: { amount: true, paidAmount: true },
    }),
    db.job.groupBy({
      by: ["service"],
      where: { deletedAt: null, completedAt: { gte: mStart, lte: mEnd } },
      _sum: { jobValue: true },
      _count: true,
    }),
    getMonthlyLedgerForAllStaff(now.getFullYear(), now.getMonth() + 1),
  ]);

  const collected = monthCollected._sum.paidAmount ?? 0;
  const lastMonthCollected = lastCollected._sum.paidAmount ?? 0;
  const expenses = monthExpenses._sum.amount ?? 0;
  const materialCost = materialExpenses._sum.amount ?? 0;
  const staffCost = staffLedger.reduce((s, r) => s + (r.earned ?? 0), 0);
  const pendingCollections = (pendingAgg._sum.amount ?? 0) - (pendingAgg._sum.paidAmount ?? 0);
  const netProfit = collected - expenses;
  const cashFlow = collected - expenses;
  const monthlyGrowth =
    lastMonthCollected > 0 ? Math.round(((collected - lastMonthCollected) / lastMonthCollected) * 100) : 0;

  const topServices = serviceRows
    .map((r) => ({ label: SERVICE_LABELS[r.service] ?? r.service, revenue: r._sum.jobValue ?? 0, jobs: r._count }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    bankBalance: settings?.bankBalance ?? null,
    netProfit,
    cashFlow,
    pendingCollections,
    monthlyGrowth,
    collected,
    expenses,
    staffCost,
    materialCost,
    topServices,
  };
}

/** Per lead-source funnel — leads, converted to a job, conversion %. */
export async function getLeadSourceStats(months = 3) {
  const since = subMonths(new Date(), months);
  const leads = await db.lead.findMany({
    where: { deletedAt: null, createdAt: { gte: since } },
    select: { source: true, stage: true },
  });

  const map = new Map<string, { leads: number; converted: number }>();
  for (const l of leads) {
    const key = l.source || "UNKNOWN";
    const row = map.get(key) ?? { leads: 0, converted: 0 };
    row.leads += 1;
    if (l.stage === "JOB_SCHEDULED" || l.stage === "COMPLETED" || l.stage === "CONFIRMED") row.converted += 1;
    map.set(key, row);
  }

  return [...map.entries()]
    .map(([source, v]) => ({
      source,
      label: LEAD_SOURCE_LABELS[source] ?? source,
      leads: v.leads,
      converted: v.converted,
      conversion: v.leads > 0 ? Math.round((v.converted / v.leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}
