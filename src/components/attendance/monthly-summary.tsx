"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  employeeCode: string;
  wageType: string;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  offDays: number;
  advanceTotal: number;
  fineTotal: number;
  rewardTotal: number;
  netBalance: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AttendanceMonthlySummary({
  rows,
  year,
  month,
  canViewSalary,
}: {
  rows: Row[];
  year: number;
  month: number;
  canViewSalary: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setMonth(y: number, m: number) {
    const q = new URLSearchParams(params.toString());
    q.set("year", String(y));
    q.set("month", String(m));
    router.push(`/attendance?${q.toString()}`);
  }

  const years = [year - 1, year, year + 1];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Monthly Summary</CardTitle>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(year, Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setMonth(Number(v), month)}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto max-sm:px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead className="text-center">Present</TableHead>
              <TableHead className="text-center">Absent</TableHead>
              <TableHead className="text-center max-sm:hidden">Off</TableHead>
              {canViewSalary && <TableHead className="text-right max-sm:hidden">Advance</TableHead>}
              {canViewSalary && <TableHead className="text-right max-sm:hidden">Fine</TableHead>}
              {canViewSalary && <TableHead className="text-right max-sm:hidden">Reward</TableHead>}
              {canViewSalary && <TableHead className="text-right">Net Payable</TableHead>}
              {canViewSalary && <TableHead className="text-right max-sm:hidden">Slip</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground max-sm:hidden">{r.employeeCode} · {r.wageType}</p>
                </TableCell>
                <TableCell className="text-center text-sm">{r.presentDays}{r.halfDays ? ` +${r.halfDays}½` : ""}</TableCell>
                <TableCell className="text-center text-sm">{r.absentDays}</TableCell>
                <TableCell className="text-center text-sm max-sm:hidden">{r.offDays}</TableCell>
                {canViewSalary && <TableCell className="text-right text-sm max-sm:hidden">{formatINR(r.advanceTotal)}</TableCell>}
                {canViewSalary && <TableCell className="text-right text-sm max-sm:hidden">{formatINR(r.fineTotal)}</TableCell>}
                {canViewSalary && <TableCell className="text-right text-sm max-sm:hidden">{formatINR(r.rewardTotal)}</TableCell>}
                {canViewSalary && <TableCell className="text-right text-sm font-semibold">{formatINR(r.netBalance)}</TableCell>}
                {canViewSalary && (
                  <TableCell className="text-right max-sm:hidden">
                    <Button variant="outline" size="icon" className="size-8" asChild>
                      <a href={`/api/staff/${r.id}/payslip/pdf?year=${year}&month=${month}`} target="_blank" rel="noreferrer" title="Salary slip">
                        <FileDown className="size-3.5" />
                      </a>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
