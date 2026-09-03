import { getProfitData } from "@/server/profit";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard } from "@/components/charts/chart-card";
import { DailyRevenueChart } from "@/components/charts/daily-revenue-chart";
import { MonthlyProfitChart } from "@/components/charts/monthly-profit-chart";
import { LeadConversionChart } from "@/components/charts/lead-conversion-chart";
import { StaffJobsChart, AvailabilityPieChart } from "@/components/charts/staff-utilization-chart";
import { formatINR } from "@/lib/utils";
import { TrendingUp, TrendingDown, Percent } from "lucide-react";

export default async function ProfitDashboardPage() {
  const data = await getProfitData();

  const currentMonth = data.monthly[data.monthly.length - 1];
  const totalRevenue30 = data.dailyRevenue.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses30 = data.dailyRevenue.reduce((s, d) => s + d.expenses, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Profit Dashboard" description="Revenue, expenses and profit at a glance." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue (30d)" value={formatINR(totalRevenue30)} icon={<TrendingUp className="size-4" />} tone="primary" />
        <StatCard label="Expenses (30d)" value={formatINR(totalExpenses30)} icon={<TrendingDown className="size-4" />} tone="warning" />
        <StatCard label="This Month's Profit" value={formatINR(currentMonth?.profit ?? 0)} icon={<TrendingUp className="size-4" />} tone="success" />
        <StatCard label="Lead → Paid Conversion" value={`${data.conversionRate}%`} icon={<Percent className="size-4" />} />
      </div>

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
    </div>
  );
}
