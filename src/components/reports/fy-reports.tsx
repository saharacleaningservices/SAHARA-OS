"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REPORTS = [
  ["sales", "Sales", "Every invoice (CRM + MyBillBook history), monthly totals"],
  ["gst", "GST", "GST register with CGST / SGST split and monthly totals"],
  ["quotations", "Quotations", "Every quotation with status and value"],
] as const;

/** Financial-year reports: pick FY 24-25 etc., one click downloads the Excel file. */
export function FyReports({ options }: { options: { value: string; label: string }[] }) {
  const [fy, setFy] = useState(options[0]?.value ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Financial year reports (1 Apr – 31 Mar)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-[220px] space-y-1.5">
          <Label>Financial year</Label>
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {REPORTS.map(([key, label, hint]) => (
            <div key={key} className="space-y-1 rounded-lg border p-3">
              <Button asChild className="w-full">
                <a href={`/api/export/fy?fy=${fy}&report=${key}`}>
                  <Download className="size-4" /> {label} (Excel)
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
