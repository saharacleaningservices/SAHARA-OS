import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfMonth } from "date-fns";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";

export async function getRevenueDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);

  const [
    todayPayments,
    monthPayments,
    allPaidAgg,
    allRaisedAgg,
    activeAmc,
    monthUpsells,
    pendingPayments,
    completedJobs,
    jobsByCustomer,
  ] = await Promise.all([
    db.payment.aggregate({ where: { deletedAt: null, status: "PAID", paidDate: { gte: todayStart } }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { deletedAt: null, status: "PAID", paidDate: { gte: monthStart } }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { deletedAt: null }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
    db.amcContract.aggregate({ where: { status: "ACTIVE", deletedAt: null }, _sum: { amount: true }, _count: true }),
    db.upsellEvent.aggregate({ where: { accepted: true, createdAt: { gte: monthStart } }, _sum: { comboValue: true }, _count: true }),
    db.payment.findMany({ where: { deletedAt: null, status: { not: "PAID" } }, select: { amount: true, paidAmount: true } }),
    db.job.findMany({
      where: { deletedAt: null, status: "COMPLETED" },
      select: { jobValue: true, service: true, customerName: true, jobNumber: true, lead: { select: { source: true } } },
    }),
    db.job.findMany({ where: { deletedAt: null, status: "COMPLETED" }, select: { customerMobile: true } }),
  ]);

  const collectedTodayRows = await db.payment.findMany({
    where: { deletedAt: null, paidDate: { gte: todayStart, lte: todayEnd } },
    select: { paidAmount: true, amount: true, status: true },
  });
  const todaysCollection = collectedTodayRows.reduce((s, p) => s + p.paidAmount, 0);
  const advanceCollectedToday = collectedTodayRows
    .filter((p) => p.status !== "PAID" && p.paidAmount < p.amount)
    .reduce((s, p) => s + p.paidAmount, 0);

  const pendingTotal = pendingPayments.reduce((sum, p) => sum + Math.max(p.amount - p.paidAmount, 0), 0);

  const byMobile = new Map<string, number>();
  for (const j of jobsByCustomer) byMobile.set(j.customerMobile, (byMobile.get(j.customerMobile) ?? 0) + 1);
  const totalCustomers = byMobile.size;
  const repeatCustomers = [...byMobile.values()].filter((n) => n > 1).length;
  const repeatCustomerPercent = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;

  const totalRaised = allRaisedAgg._sum.amount ?? 0;
  const totalCollected = allPaidAgg._sum.paidAmount ?? 0;
  const collectionRate = totalRaised > 0 ? Math.round((totalCollected / totalRaised) * 1000) / 10 : 0;

  const completedValues = completedJobs.map((j) => j.jobValue);
  const avgTicket = completedValues.length ? Math.round(completedValues.reduce((a, b) => a + b, 0) / completedValues.length) : 0;
  const highestJob = completedJobs.reduce<{ value: number; label: string } | null>((best, j) => {
    if (!best || j.jobValue > best.value) return { value: j.jobValue, label: `${j.customerName} · ${j.jobNumber}` };
    return best;
  }, null);

  const byService = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const j of completedJobs) {
    byService.set(j.service, (byService.get(j.service) ?? 0) + j.jobValue);
    const src = j.lead?.source ?? "DIRECT";
    bySource.set(src, (bySource.get(src) ?? 0) + j.jobValue);
  }
  const serviceRevenue = [...byService.entries()]
    .map(([k, v]) => ({ label: SERVICE_LABELS[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const sourceRevenue = [...bySource.entries()]
    .map(([k, v]) => ({ label: LEAD_SOURCE_LABELS[k] ?? (k === "DIRECT" ? "Unknown / no lead" : k), value: v }))
    .sort((a, b) => b.value - a.value);

  return {
    todayRevenue: todayPayments._sum.paidAmount ?? 0,
    monthlyRevenue: monthPayments._sum.paidAmount ?? 0,
    amcRevenue: activeAmc._sum.amount ?? 0,
    amcActiveCount: activeAmc._count,
    upsellRevenue: monthUpsells._sum.comboValue ?? 0,
    upsellAcceptedCount: monthUpsells._count,
    repeatCustomerPercent,
    totalCustomers,
    pendingPayments: pendingTotal,
    balancePending: pendingTotal,
    todaysCollection,
    advanceCollectedToday,
    collectionRate,
    avgTicket,
    highestJobValue: highestJob?.value ?? 0,
    highestJobLabel: highestJob?.label ?? "—",
    completedJobCount: completedJobs.length,
    serviceRevenue,
    sourceRevenue,
  };
}

export type RevenueDashboardData = Awaited<ReturnType<typeof getRevenueDashboard>>;
