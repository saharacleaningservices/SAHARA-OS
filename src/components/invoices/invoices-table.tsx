"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, MessageCircle } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { updateInvoiceStatus } from "@/server/actions/quotations";
import { formatINR, formatDateTime, toWhatsAppLink } from "@/lib/utils";

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
  /** Secure customer invoice page (completed jobs only). */
  customerUrl?: string | null;
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

  const statusSelect = (inv: Invoice, w = "w-36") => (
    <Select value={inv.status} onValueChange={(v) => changeStatus(inv.id, v)} disabled={pending && busyId === inv.id}>
      <SelectTrigger size="sm" className={w}>
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
  );
  const send = (inv: Invoice) =>
    inv.customerUrl && inv.customerMobile ? (
      <Button variant="outline" size="sm" asChild>
        <a
          href={toWhatsAppLink(inv.customerMobile, `Hi ${inv.customerName}, here is your final invoice ${inv.invoiceNumber} from Sahara Cleaning Services:
${inv.customerUrl}

For any help, call or WhatsApp 7083347130 / 8956567130.`)}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="size-3.5" /> Send
        </a>
      </Button>
    ) : null;
  const source = (inv: Invoice) => (inv.job ? `Job ${inv.job.jobNumber}` : inv.quotation ? `Quotation ${inv.quotation.quoteNumber}` : "Manual");

  return (
    <>
    {/* Phone: compact cards — no sideways scrolling. */}
    <div className="space-y-2 sm:hidden">
      {invoices.map((inv) => (
        <div key={inv.id} className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{inv.customerName}</p>
              <p className="truncate text-xs text-muted-foreground">{inv.invoiceNumber} · {source(inv)} · {formatDateTime(inv.createdAt)}</p>
            </div>
            <span className="shrink-0 text-sm font-bold">{formatINR(inv.totalAmount)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {statusSelect(inv, "w-36")}
            {send(inv)}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" /> PDF
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
    <div className="overflow-x-auto rounded-xl border border-border max-sm:hidden">
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
              <TableCell className="text-xs text-muted-foreground">{source(inv)}</TableCell>
              <TableCell>{formatINR(inv.totalAmount)}</TableCell>
              <TableCell>{statusSelect(inv)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(inv.createdAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                {send(inv)}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5" /> PDF
                  </a>
                </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
