import { getRevenueDashboard } from "@/server/revenue";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatINR } from "@/lib/utils";
import { Wallet, CalendarDays, ShieldCheck, Sparkles, Users, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/current-user";

export default async function RevenueDashboardPage() {
  await requireRole(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
  const data = await getRevenueDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Dashboard" description="Live revenue across bookings, AMC and upsells." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Today's Revenue" value={formatINR(data.todayRevenue)} icon={<Wallet className="size-4" />} tone="primary" />
        <StatCard label="Monthly Revenue" value={formatINR(data.monthlyRevenue)} icon={<CalendarDays className="size-4" />} tone="success" />
        <StatCard
          label="AMC Revenue"
          value={formatINR(data.amcRevenue)}
          icon={<ShieldCheck className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="Upsell Revenue (this month)"
          value={formatINR(data.upsellRevenue)}
          icon={<Sparkles className="size-4" />}
        />
        <StatCard label="Repeat Customers" value={`${data.repeatCustomerPercent}%`} icon={<Users className="size-4" />} />
        <StatCard label="Pending Payments" value={formatINR(data.pendingPayments)} icon={<AlertTriangle className="size-4" />} tone="warning" />
      </div>

      <p className="text-xs text-muted-foreground">
        AMC Revenue = total contract value of {data.amcActiveCount} active AMC contracts. Upsell Revenue = combo
        offers accepted this month ({data.upsellAcceptedCount}). Repeat Customers = share of {data.totalCustomers}{" "}
        customers with more than one completed job.
      </p>
    </div>
  );
}
