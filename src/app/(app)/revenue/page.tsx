import { getRevenueDashboard } from "@/server/revenue";
import { getServiceAnalytics } from "@/server/analytics";
import { getLeadSourceStats } from "@/server/owner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ServiceAnalyticsChart } from "@/components/charts/service-analytics-chart";
import { formatINR } from "@/lib/utils";
import { Wallet, CalendarDays, ShieldCheck, Sparkles, Users, AlertTriangle, Percent, Ticket, Trophy, HandCoins, Banknote } from "lucide-react";
import { requireRole } from "@/lib/current-user";

function RevenueBars({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No completed jobs yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{r.label}</span>
            <span className="font-medium text-foreground">{formatINR(r.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${total > 0 ? Math.max(3, Math.round((r.value / total) * 100)) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function RevenueDashboardPage() {
  // Revenue Dashboard is explicitly restricted to Super Admin only (Profit &
  // Revenue stay owner-only) — see src/lib/permissions.ts canViewRevenue.
  await requireRole(["ADMIN"]);
  const [data, analytics, sourceStats] = await Promise.all([
    getRevenueDashboard(),
    getServiceAnalytics(),
    getLeadSourceStats(3),
  ]);
  const serviceTotal = data.serviceRevenue.reduce((s, r) => s + r.value, 0);
  const sourceTotal = data.sourceRevenue.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Dashboard" description="Live revenue across bookings, AMC and upsells." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={formatINR(data.todayRevenue)} icon={<Wallet className="size-4" />} tone="primary" />
        <StatCard href="/payments?filter=paid" label="Today's Collection" value={formatINR(data.todaysCollection)} icon={<HandCoins className="size-4" />} tone="success" />
        <StatCard label="Advance Collected Today" value={formatINR(data.advanceCollectedToday)} icon={<Banknote className="size-4" />} />
        <StatCard label="Monthly Revenue" value={formatINR(data.monthlyRevenue)} icon={<CalendarDays className="size-4" />} tone="success" />
        <StatCard href="/payments?filter=pending" label="Pending Collection" value={formatINR(data.pendingPayments)} icon={<AlertTriangle className="size-4" />} tone="warning" />
        <StatCard label="Balance Pending" value={formatINR(data.balancePending)} icon={<Wallet className="size-4" />} tone="warning" />
        <StatCard label="Collection Rate" value={`${data.collectionRate}%`} icon={<Percent className="size-4" />} />
        <StatCard label="Average Ticket" value={formatINR(data.avgTicket)} icon={<Ticket className="size-4" />} />
        <StatCard label="Highest Job" value={formatINR(data.highestJobValue)} trendLabel={data.highestJobLabel} icon={<Trophy className="size-4" />} tone="primary" />
        <StatCard label="AMC Revenue" value={formatINR(data.amcRevenue)} trendLabel={`${data.amcActiveCount} active`} icon={<ShieldCheck className="size-4" />} />
        <StatCard label="Upsell Revenue (mo)" value={formatINR(data.upsellRevenue)} trendLabel={`${data.upsellAcceptedCount} accepted`} icon={<Sparkles className="size-4" />} />
        <StatCard label="Repeat Customers" value={`${data.repeatCustomerPercent}%`} trendLabel={`of ${data.totalCustomers}`} icon={<Users className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Service-wise Revenue</CardTitle></CardHeader>
          <CardContent><RevenueBars rows={data.serviceRevenue} total={serviceTotal} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead Source Revenue</CardTitle></CardHeader>
          <CardContent><RevenueBars rows={data.sourceRevenue} total={sourceTotal} /></CardContent>
        </Card>
      </div>

      {/* ── Monthly service analytics (Phase 10) ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Service Analytics — {new Date(analytics.year, analytics.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-60">
            <ServiceAnalyticsChart data={analytics.rows} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="text-sm font-medium text-foreground">{r.label}</TableCell>
                    <TableCell className="text-right text-sm">{r.leads}</TableCell>
                    <TableCell className="text-right text-sm">{r.bookings}</TableCell>
                    <TableCell className="text-right text-sm">{formatINR(r.revenue)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{r.conversion}%</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-sm font-semibold">Total</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{analytics.totals.leads}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{analytics.totals.bookings}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatINR(analytics.totals.revenue)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {analytics.totals.leads > 0 ? Math.round((analytics.totals.bookings / analytics.totals.leads) * 100) : 0}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Lead source intelligence ─────────────────────────────── */}
      {sourceStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Lead Source Intelligence — last 3 months</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceStats.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="text-sm font-medium text-foreground">{s.label}</TableCell>
                    <TableCell className="text-right text-sm">{s.leads}</TableCell>
                    <TableCell className="text-right text-sm">{s.converted}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{s.conversion}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Collection Rate = collected / total invoiced. Average Ticket & service/source splits are computed over the
        {" "}{data.completedJobCount} completed jobs. AMC Revenue = contract value of active AMC contracts.
      </p>
    </div>
  );
}
