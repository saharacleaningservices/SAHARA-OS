"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { updateInvoiceStatus } from "@/server/actions/quotations";
import { formatINR, formatDateTime } from "@/lib/utils";

type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerMobile: string | null;
  totalAmount: number;
  status: string;
  createdAt: Date;
  job: { jobNumber: string } | null;
  quotation: { quoteNumber: string } | null;
};

const STATUS_OPTIONS = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"];

const STATUS_VARIANT: Record<string, "muted" | "info" | "success" | "destructive" | "warning"> = {
  DRAFT: "muted",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  CANCELLED: "destructive",
};

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeStatus(id: string, status: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await updateInvoiceStatus(id, status as never);
      setBusyId(null);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Status updated");
    });
  }

  if (invoices.length === 0) {
    return <EmptyState title="No invoices yet" description="Invoices are created automatically when a job completes, or you can create one directly." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
              <TableCell>
                {inv.customerName}
                <div className="text-xs text-muted-foreground">{inv.customerMobile}</div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {inv.job ? `Job ${inv.job.jobNumber}` : inv.quotation ? `Quotation ${inv.quotation.quoteNumber}` : "Manual"}
              </TableCell>
              <TableCell>{formatINR(inv.totalAmount)}</TableCell>
              <TableCell>
                <Select
                  value={inv.status}
                  onValueChange={(v) => changeStatus(inv.id, v)}
                  disabled={pending && busyId === inv.id}
                >
                  <SelectTrigger size="sm" className="w-36">
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "muted"}>{inv.status.replace("_", " ")}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(inv.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5" /> PDF
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
