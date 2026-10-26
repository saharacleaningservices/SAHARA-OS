import { ResponsiveFold } from "@/components/shared/responsive-fold";
import { getProfitData } from "@/server/profit";
import { getOwnerSnapshot } from "@/server/owner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerBankBalanceCard } from "@/components/owner/owner-bank-balance-card";
import { getCompanySettings } from "@/server/settings";
import { ChartCard } from "@/components/charts/chart-card";
import { DailyRevenueChart } from "@/components/charts/daily-revenue-chart";
import { MonthlyProfitChart } from "@/components/charts/monthly-profit-chart";
import { LeadConversionChart } from "@/components/charts/lead-conversion-chart";
import { StaffJobsChart, AvailabilityPieChart } from "@/components/charts/staff-utilization-chart";
import { formatINR } from "@/lib/utils";
import { TrendingUp, TrendingDown, Percent } from "lucide-react";
import { requireRole } from "@/lib/current-user";

export default async function ProfitDashboardPage() {
  // Profit Dashboard is explicitly restricted to Super Admin only (see
  // src/lib/permissions.ts canViewFinancials) — Accounts does not get it.
  const session = await requireRole(["ADMIN"]);
  const isOwner = session.role === "ADMIN";
  const [data, owner, settings] = await Promise.all([
    getProfitData(),
    isOwner ? getOwnerSnapshot() : Promise.resolve(null),
    isOwner ? getCompanySettings() : Promise.resolve(null),
  ]);

  const currentMonth = data.monthly[data.monthly.length - 1];
  const totalRevenue30 = data.dailyRevenue.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses30 = data.dailyRevenue.reduce((s, d) => s + d.expenses, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Profit Dashboard" description="Revenue, expenses and profit at a glance." />
      <a href="/profit/marketing" className="inline-block rounded-lg border px-3 py-1.5 text-sm font-semibold text-primary">Marketing Dashboard (sources, campaigns, WhatsApp, ROI) →</a>

      {owner && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Owner Dashboard — this month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <StatCard label="Net Profit" value={formatINR(owner.netProfit)} icon={<TrendingUp className="size-4" />} tone={owner.netProfit >= 0 ? "green" : "red"} />
              <StatCard label="Cash Flow" value={formatINR(owner.cashFlow)} icon={<TrendingUp className="size-4" />} tone={owner.cashFlow >= 0 ? "green" : "red"} />
              <StatCard label="Pending Collections" value={formatINR(owner.pendingCollections)} icon={<Percent className="size-4" />} tone="orange" />
              <StatCard label="Monthly Growth" value={`${owner.monthlyGrowth}%`} trend={owner.monthlyGrowth} icon={<TrendingUp className="size-4" />} tone={owner.monthlyGrowth >= 0 ? "green" : "red"} />
              <StatCard label="Collected" value={formatINR(owner.collected)} icon={<TrendingUp className="size-4" />} tone="blue" />
              <StatCard label="Staff Cost" value={formatINR(owner.staffCost)} icon={<TrendingDown className="size-4" />} tone="purple" />
              <StatCard label="Material Cost" value={formatINR(owner.materialCost)} icon={<TrendingDown className="size-4" />} tone="indigo" />
              <OwnerBankBalanceCard value={settings?.bankBalance ?? null} />
            </div>
            {owner.topServices.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Services (this month)</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {owner.topServices.map((s) => (
                    <div key={s.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                      <span className="text-foreground">{s.label} <span className="text-xs text-muted-foreground">· {s.jobs} job{s.jobs === 1 ? "" : "s"}</span></span>
                      <span className="font-medium text-foreground">{formatINR(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue (30d)" value={formatINR(totalRevenue30)} icon={<TrendingUp className="size-4" />} tone="primary" />
        <StatCard label="Expenses (30d)" value={formatINR(totalExpenses30)} icon={<TrendingDown className="size-4" />} tone="warning" />
        <StatCard label="This Month's Profit" value={formatINR(currentMonth?.profit ?? 0)} icon={<TrendingUp className="size-4" />} tone="success" />
        <StatCard label="Lead → Paid Conversion" value={`${data.conversionRate}%`} icon={<Percent className="size-4" />} />
      </div>

      <ResponsiveFold title="Charts & trends" hint="revenue · profit · conversion · staff" className="border-0 bg-transparent sm:border-0">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Revenue" description="Last 30 days — revenue vs expenses">
          <DailyRevenueChart data={data.dailyRevenue} />
        </ChartCard>
        <ChartCard title="Monthly Profit" description="Last 6 months">
          <MonthlyProfitChart data={data.monthly} />
        </ChartCard>
        <ChartCard title="Lead Conversion" description={`${data.totalLeads} total leads in the pipeline`}>
          <LeadConversionChart data={data.funnel} />
        </ChartCard>
        <ChartCard title="Staff Utilization" description="Jobs assigned per staff member — last 30 days">
          <StaffJobsChart data={data.utilizationByStaff} />
        </ChartCard>
      </div>

      <ChartCard title="Staff Availability" description="Current availability across the team" className="xl:max-w-md">
        <AvailabilityPieChart data={data.availabilityBreakdown} />
      </ChartCard>
      </ResponsiveFold>
    </div>
  );
}
