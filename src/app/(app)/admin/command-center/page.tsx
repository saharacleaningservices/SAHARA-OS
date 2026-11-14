import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/current-user";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { pctChange, type WeekMetrics } from "@/lib/weekly-command-center";
import { getWeeklyCommandCenter } from "@/server/owner-command-center";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
const delta = (a: number, b: number) => {
  const p = pctChange(a, b);
  return p == null ? "—" : `${p > 0 ? "+" : ""}${p}%`;
};

type Row = { label: string; get: (m: WeekMetrics) => number | null; fmt: (n: number | null) => string };
const ROWS: Row[] = [
  { label: "Leads", get: (m) => m.leads, fmt: (n) => num(n ?? 0) },
  { label: "Confirmed Bookings (jobs created)", get: (m) => m.confirmedBookings, fmt: (n) => num(n ?? 0) },
  { label: "Completed Jobs", get: (m) => m.completedJobs, fmt: (n) => num(n ?? 0) },
  { label: "Gross Revenue (completed jobs)", get: (m) => m.grossRevenue, fmt: (n) => inr(n ?? 0) },
  { label: "Net Collected", get: (m) => m.netCollected, fmt: (n) => inr(n ?? 0) },
  { label: "· UPI / QR", get: (m) => m.collectedUpi, fmt: (n) => inr(n ?? 0) },
  { label: "· Cash", get: (m) => m.collectedCash, fmt: (n) => inr(n ?? 0) },
  { label: "· Bank / other", get: (m) => m.collectedOther, fmt: (n) => inr(n ?? 0) },
  { label: "Average Order Value", get: (m) => m.aov, fmt: (n) => inr(n ?? 0) },
  { label: "Cross-Sell Revenue", get: (m) => m.crossSellRevenue, fmt: (n) => inr(n ?? 0) },
  { label: "Jobs with a cross-sell", get: (m) => m.crossSellJobs, fmt: (n) => num(n ?? 0) },
  { label: "Service Start Code compliance", get: (m) => m.otpCompliance, fmt: pct },
];

// Weekly Command Center (owner 2026-11-14): executive This Week vs Last Week view. Super Admin only (server-enforced).
export default async function CommandCenterPage() {
  const user = await requireRole(["ADMIN"]);
  if (user.role !== "ADMIN") notFound();
  const { thisWeek, lastWeek } = await getWeeklyCommandCenter();
  const t = thisWeek.m;
  const l = lastWeek.m;
  const sources = [...new Set([...t.leadSources, ...l.leadSources].map((s) => s.source))];
  const countOf = (m: WeekMetrics, s: string) => m.leadSources.find((x) => x.source === s)?.count ?? 0;
  sources.sort((a, b) => countOf(t, b) - countOf(t, a) || countOf(l, b) - countOf(l, a));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Command Center"
        description={`This Week (${thisWeek.label}, to date) vs Last Week (${lastWeek.label}) · IST, Monday–Sunday`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Leads" value={num(t.leads)} trend={pctChange(t.leads, l.leads) ?? undefined} trendLabel="vs last week" tone="blue" />
        <StatCard label="Confirmed Bookings" value={num(t.confirmedBookings)} trend={pctChange(t.confirmedBookings, l.confirmedBookings) ?? undefined} tone="indigo" />
        <StatCard label="Completed Jobs" value={num(t.completedJobs)} trend={pctChange(t.completedJobs, l.completedJobs) ?? undefined} tone="teal" />
        <StatCard label="Gross Revenue" value={inr(t.grossRevenue)} trend={pctChange(t.grossRevenue, l.grossRevenue) ?? undefined} tone="green" />
        <StatCard label="Net Collected" value={inr(t.netCollected)} trend={pctChange(t.netCollected, l.netCollected) ?? undefined} tone="success" />
        <StatCard label="AOV" value={inr(t.aov)} trend={pctChange(t.aov, l.aov) ?? undefined} tone="purple" />
        <StatCard label="Cross-Sell Revenue" value={inr(t.crossSellRevenue)} trend={pctChange(t.crossSellRevenue, l.crossSellRevenue) ?? undefined} tone="gold" />
        <StatCard label="Start Code compliance" value={pct(t.otpCompliance)} tone={t.otpCompliance != null && t.otpCompliance < 90 ? "warning" : "primary"} />
      </div>

      <Card>
        <CardHeader><CardTitle>This Week vs Last Week</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Metric</TableHead><TableHead className="text-right">This Week</TableHead><TableHead className="text-right">Last Week</TableHead><TableHead className="text-right">Change</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => {
                const a = r.get(t);
                const b = r.get(l);
                return (
                  <TableRow key={r.label}>
                    <TableCell className={r.label.startsWith("·") ? "pl-6 text-muted-foreground" : "font-medium"}>{r.label}</TableCell>
                    <TableCell className="text-right">{r.fmt(a)}</TableCell>
                    <TableCell className="text-right">{r.fmt(b)}</TableCell>
                    <TableCell className="text-right">{a == null || b == null ? "—" : delta(a, b)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">This Week</TableHead><TableHead className="text-right">Last Week</TableHead></TableRow></TableHeader>
              <TableBody>
                {sources.map((s) => (
                  <TableRow key={s}>
                    <TableCell>{LEAD_SOURCE_LABELS[s] ?? s}</TableCell>
                    <TableCell className="text-right">{countOf(t, s)}</TableCell>
                    <TableCell className="text-right">{countOf(l, s)}</TableCell>
                  </TableRow>
                ))}
                {sources.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No leads in either week.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Service Start Code</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>This Week: <b>{t.otpVerified}</b> of <b>{t.otpIssued}</b> completed jobs with a start code were verified ({pct(t.otpCompliance)}).</p>
            <p>Last Week: <b>{l.otpVerified}</b> of <b>{l.otpIssued}</b> ({pct(l.otpCompliance)}).</p>
            <p className="text-xs text-muted-foreground">
              Net Collected = payments received in the week (by paid date), split by mode. Cross-Sell = add-on lines (chimney, fridge, kitchen pest,
              sofa, mattress, kitchen, bathroom) that are not the booking&apos;s main service. Gross Revenue = final value of jobs completed in the week.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
