"use client";

import { ResponsiveFold } from "@/components/shared/responsive-fold";
import { useState } from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SHEETS = [
  ["Summary", "Sales, revenue, total expenses, net / balance and staff totals"],
  ["Business Summary", "Month by month: sales, revenue, purchase, salary, other expenses, total expenses, net"],
  ["Sales", "Invoices issued"],
  ["Revenue", "Payments received (same rule as the Profit dashboard)"],
  ["Purchase", "Manual purchase entries (material, chemicals, equipment)"],
  ["Expenses", "Every expense entry with its category"],
  ["Expenses by Category", "Totals per category (salary, rent, vendor, fuel/auto, repairs…)"],
  ["Attendance", "Every staff day marked"],
  ["Salary", "Per staff per month: earned, rewards, advances, fines, net payable"],
  ["Salary Paid", "Expenses recorded as Salary Paid"],
  ["Advance", "Advances given"],
  ["Debit-Fine", "Debits / fines with reason"],
  ["Rewards", "Individual rewards"],
  ["Team Incentives", "₹ total per job + team (never split per person)"],
  ["Jobs-Team", "Jobs with the team exactly as assigned"],
];

export function ExportCenter({ years }: { years: number[] }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const href = `/api/export/period?year=${year}&month=${month}`;
  const label = month === "all" ? `Year ${year}` : `${MONTHS[Number(month) - 1]} ${year}`;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-success" /> Download Excel workbook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole year</SelectItem>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button asChild className="w-full">
            <a href={href}>
              <Download className="size-4" /> Download {label}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">Built live from the CRM (single source of truth). Demo and deleted records are excluded. Each download is logged.</p>
        </CardContent>
      </Card>
      <ResponsiveFold title="Sheets in the workbook">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sheets in the workbook</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SHEETS.map(([name, desc]) => (
              <li key={name} className="rounded-lg border border-border p-2.5">
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Purchases are entered in Expenses (Housekeeping Material, Chemicals, Equipment) — there is no separate purchase module. They are listed on
            their own sheet and are already included in Total Expenses. Net / Balance = Revenue − Total Expenses, matching the Profit dashboard.
          </p>
        </CardContent>
      </Card>
      </ResponsiveFold>
    </div>
  );
}
