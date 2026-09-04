import { db } from "@/lib/db";
import { startOfDay, startOfMonth } from "date-fns";

export async function getRevenueDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [todayPayments, monthPayments, activeAmc, monthUpsells, pendingPayments, jobsByCustomer] = await Promise.all([
    db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: todayStart } }, _sum: { paidAmount: true } }),
    db.payment.aggregate({ where: { status: "PAID", paidDate: { gte: monthStart } }, _sum: { paidAmount: true } }),
    db.amcContract.aggregate({ where: { status: "ACTIVE", deletedAt: null }, _sum: { amount: true }, _count: true }),
    db.upsellEvent.aggregate({ where: { accepted: true, createdAt: { gte: monthStart } }, _sum: { comboValue: true }, _count: true }),
    db.payment.findMany({ where: { deletedAt: null, status: { not: "PAID" } }, select: { amount: true, paidAmount: true } }),
    db.job.findMany({ where: { deletedAt: null, status: "COMPLETED" }, select: { customerMobile: true } }),
  ]);

  const pendingTotal = pendingPayments.reduce((sum, p) => sum + Math.max(p.amount - p.paidAmount, 0), 0);

  const byMobile = new Map<string, number>();
  for (const j of jobsByCustomer) {
    byMobile.set(j.customerMobile, (byMobile.get(j.customerMobile) ?? 0) + 1);
  }
  const totalCustomers = byMobile.size;
  const repeatCustomers = Array.from(byMobile.values()).filter((n) => n > 1).length;
  const repeatCustomerPercent = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;

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
  };
}

export type RevenueDashboardData = Awaited<ReturnType<typeof getRevenueDashboard>>;
