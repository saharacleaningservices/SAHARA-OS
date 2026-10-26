"use client";

import { FileArchive, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Owner-only portable business-data export (2026-09-22 master prompt §9,
 * §17) — kept as its own card, separate from the System Recovery Backup
 * card above: this is a customer/business-data snapshot for migration and
 * safekeeping, not a full database recovery file.
 */
export function BusinessExportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileArchive className="size-4" /> Business Data Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A portable snapshot of your customers, leads, bookings, jobs, payments, service history, staff,
          attendance and AMC contracts — as an Excel workbook plus plain CSVs, ready to open in a spreadsheet
          or import into another system. Generated on demand; nothing is stored on the server afterwards.
        </p>
        <Button asChild>
          <a href="/api/export/business-data">
            <Download className="size-4" /> Download Business Data (ZIP)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
