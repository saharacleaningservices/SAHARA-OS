"use client";

import { SendQuotationButton } from "@/components/leads/send-quotation-button";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { FileText, ArrowRightCircle, Link2 } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { updateQuotationStatus, convertQuotationToInvoice, getQuotationBookingLink } from "@/server/actions/quotations";
import { formatINR, formatDate } from "@/lib/utils";

type Quotation = {
  id: string;
  leadId: string;
  quoteNumber: string;
  totalAmount: number;
  status: string;
  validTill: Date | null;
  createdAt: Date;
  lead: { leadNumber: string; name: string; mobile: string };
  invoice: { id: string; invoiceNumber: string } | null;
};

const STATUS_OPTIONS = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];

const STATUS_VARIANT: Record<string, "muted" | "info" | "success" | "destructive" | "warning"> = {
  DRAFT: "muted",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CANCELLED: "destructive",
};

export function QuotationsTable({ quotations }: { quotations: Quotation[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeStatus(id: string, status: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await updateQuotationStatus(id, status as never);
      setBusyId(null);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Status updated");
    });
  }

  function convert(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await convertQuotationToInvoice(id);
      setBusyId(null);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Invoice created");
    });
  }

  function copyBookingLink(id: string) {
    startTransition(async () => {
      const res = await getQuotationBookingLink(id);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("url" in res && res.url) {
        await navigator.clipboard.writeText(res.url).catch(() => {});
        toast.success("Booking link copied — share it with the customer");
      }
    });
  }

  if (quotations.length === 0) {
    return <EmptyState title="No quotations yet" description="Generate one from a Lead's detail page." />;
  }

  const statusSelect = (q: (typeof quotations)[number], w = "w-32") => (
    <Select value={q.status} onValueChange={(v) => changeStatus(q.id, v)} disabled={pending && busyId === q.id}>
      <SelectTrigger size="sm" className={w}>
        <Badge variant={STATUS_VARIANT[q.status] ?? "muted"}>{q.status}</Badge>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
    {/* Phone: one compact card per quotation — no sideways scrolling. */}
    <div className="space-y-2 sm:hidden">
      {quotations.map((q) => (
        <div key={q.id} className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/leads/${q.leadId}`} className="block truncate text-sm font-semibold">{q.lead?.name ?? "—"}</Link>
              <p className="text-xs text-muted-foreground">
                {q.quoteNumber}
                {q.validTill ? ` · valid till ${formatDate(q.validTill)}` : ""}
                {q.invoice ? ` · ${q.invoice.invoiceNumber}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold">{formatINR(q.totalAmount)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {statusSelect(q, "w-28")}
            {q.lead?.mobile && <SendQuotationButton quotationId={q.id} quoteNumber={q.quoteNumber} status={q.status} name={q.lead.name} mobile={q.lead.mobile} />}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                <FileText className="size-3.5" /> PDF
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => copyBookingLink(q.id)} aria-label="Copy booking link">
              <Link2 className="size-3.5" />
            </Button>
            {!q.invoice && (
              <Button variant="outline" size="sm" disabled={pending && busyId === q.id} onClick={() => convert(q.id)}>
                <ArrowRightCircle className="size-3.5" /> Invoice
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
    <div className="overflow-x-auto rounded-xl border border-border max-sm:hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Valid Till</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="font-medium">{q.quoteNumber}</TableCell>
              <TableCell>
                <Link href={`/leads/${q.leadId}`} className="hover:underline">
                  {q.lead?.name ?? "—"}
                </Link>
                <div className="text-xs text-muted-foreground">{q.lead?.mobile}</div>
              </TableCell>
              <TableCell>{formatINR(q.totalAmount)}</TableCell>
              <TableCell>{q.validTill ? formatDate(q.validTill) : "—"}</TableCell>
              <TableCell>{statusSelect(q)}</TableCell>
              <TableCell>
                {q.invoice ? (
                  <span className="text-xs text-muted-foreground">{q.invoice.invoiceNumber}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  {q.lead?.mobile && <SendQuotationButton quotationId={q.id} quoteNumber={q.quoteNumber} status={q.status} name={q.lead.name} mobile={q.lead.mobile} />}
                  <Button variant="outline" size="sm" onClick={() => copyBookingLink(q.id)} title="Copy the customer booking link for this quotation">
                    <Link2 className="size-3.5" /> Booking link
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileText className="size-3.5" /> PDF
                    </a>
                  </Button>
                  {!q.invoice && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending && busyId === q.id}
                      onClick={() => convert(q.id)}
                    >
                      <ArrowRightCircle className="size-3.5" /> To Invoice
                    </Button>
                  )}
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
