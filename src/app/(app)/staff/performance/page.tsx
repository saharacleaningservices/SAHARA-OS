import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { getStaffPerformanceReport } from "@/server/staff-performance";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { FileDown, FileSpreadsheet } from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function StaffPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  // Jobs, revenue, attendance, rewards, fines and pay in one place — same
  // ADMIN/ACCOUNTS gate as the Message Log and salary slips.
  // SUPERVISOR (Francis) removed 2026-09-21 — this report exposes
  // per-staff revenue/earned/net-balance figures, financial-adjacent data
  // outside his narrowed module list.
  // Operations removed 2026-10-08: per-staff revenue, wages, incentives and fines.
  await requireRole(["ADMIN", "ACCOUNTS"]);

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const rows = await getStaffPerformanceReport(year, month);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const totals = rows.reduce(
    (acc, r) => ({
      jobsCompleted: acc.jobsCompleted + r.jobsCompleted,
      revenueGenerated: acc.revenueGenerated + r.revenueGenerated,
    }),
    { jobsCompleted: 0, revenueGenerated: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Performance Report"
        description={`Jobs, revenue, attendance, on-time %, rewards & fines — ${monthLabel}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/staff/performance/pdf?year=${year}&month=${month}&download=1`}>
                <FileDown className="mr-1.5 size-4" /> PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/staff/performance/excel?year=${year}&month=${month}`}>
                <FileSpreadsheet className="mr-1.5 size-4" /> Excel
              </a>
            </Button>
          </div>
        }
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="month">
            Month
          </label>
          <select
            id="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="year">
            Year
          </label>
          <select
            id="year"
            name="year"
            defaultValue={year}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No active staff" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>On-time</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Half</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Off</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>Fines</TableHead>
                <TableHead>Earned</TableHead>
                <TableHead>Net Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.employeeCode} · {r.designation}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.jobsCompleted}</TableCell>
                  <TableCell className="text-sm">{formatINR(r.revenueGenerated)}</TableCell>
                  <TableCell>
                    {r.onTimePercent === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={r.onTimePercent >= 80 ? "success" : r.onTimePercent >= 50 ? "muted" : "destructive"}>
                        {r.onTimePercent}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.presentDays}</TableCell>
                  <TableCell className="text-sm">{r.halfDays}</TableCell>
                  <TableCell className="text-sm">{r.absentDays}</TableCell>
                  <TableCell className="text-sm">{r.offDays}</TableCell>
                  <TableCell className="text-sm text-success">{r.rewardTotal ? `+${formatINR(r.rewardTotal)}` : "—"}</TableCell>
                  <TableCell className="text-sm text-destructive">{r.fineTotal ? `-${formatINR(r.fineTotal)}` : "—"}</TableCell>
                  <TableCell className="text-sm">{formatINR(r.earned)}</TableCell>
                  <TableCell className="text-sm font-semibold">{formatINR(r.netBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            {rows.length} staff · {totals.jobsCompleted} jobs completed · {formatINR(totals.revenueGenerated)} revenue generated this
            month
          </p>
        </>
      )}
    </div>
  );
}
