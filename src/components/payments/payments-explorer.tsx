"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Banknote, ReceiptText, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import type { CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import { deletePayment, bulkDeletePayments, recordCollection } from "@/server/actions/payments";
import { computePaymentStatus, pendingDays } from "@/lib/payment-status";
import { formatINR, formatDate, cn, toWhatsAppLink, dayBucket } from "@/lib/utils";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";
import { paymentReceiptMessage } from "@/lib/whatsapp-templates";

type Payment = {
  id: string;
  invoiceNumber: string;
  refNumber: string;
  clientName: string;
  clientMobile: string | null;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: string;
  mode: string | null;
  serviceLabel: string | null;
  serviceVariant: string | null;
  packageName: string | null;
  invoiceAttachmentUrl: string | null;
  mybillbookInvoiceNo: string | null;
  notes: string | null;
};

const PAGE_SIZE = 12;
const FILTERS = ["ALL", "PENDING", "PARTIAL", "PAID", "TODAY", "TOMORROW", "OVERDUE"] as const;
const FILTER_LABELS: Record<string, string> = {
  ALL: "All", PENDING: "Pending", PARTIAL: "Partial", PAID: "Paid", TODAY: "Due Today", TOMORROW: "Due Tomorrow", OVERDUE: "Overdue",
};

function derivedStatus(p: Payment) {
  if (p.status === "PAID" || p.paidAmount >= p.amount - 0.01) return "PAID";
  if (p.paidAmount > 0) return "PARTIAL";
  return computePaymentStatus(p.dueDate, p.status);
}

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  PAID: "success", PARTIAL: "info", DUE_SOON: "warning", OVERDUE: "destructive", PENDING: "muted",
};
const STATUS_LABEL: Record<string, string> = {
  PAID: "Paid", PARTIAL: "Partially Paid", DUE_SOON: "Due Soon", OVERDUE: "Overdue", PENDING: "Pending",
};

function RowActions({ p, details }: { p: Payment; details: CompanyPaymentDetails }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const balance = Math.max(p.amount - p.paidAmount, 0);
  const st = derivedStatus(p);

  function collect(full: boolean, mode?: "CASH") {
    startTransition(async () => {
      const res = await recordCollection(p.id, full ? { full: true, mode } : { amount: balance, mode });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.fullyPaid ? "Fully paid" : "Collection recorded");
      router.refresh();
    });
  }

  const receipt = paymentReceiptMessage({
    customerName: p.clientName,
    bookingId: p.refNumber,
    service: p.serviceLabel,
    amountPaid: p.paidAmount,
    mode: p.mode,
    balance,
  });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {st !== "PAID" && (
        <>
          <Button size="sm" variant="success" onClick={() => collect(true)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <HandCoins className="size-3.5" />}
            Collect Balance
          </Button>
          <Button size="sm" variant="outline" onClick={() => collect(true, "CASH")} disabled={pending} title="Record a cash collection of the full balance">
            <Banknote className="size-3.5" /> Record Cash
          </Button>
          <SendPaymentLinkButton
            mobile={p.clientMobile}
            details={details}
            context={{
              customerName: p.clientName,
              bookingId: p.refNumber,
              service: p.serviceLabel,
              packageName: p.packageName,
              quote: p.amount,
              advance: p.paidAmount,
              balance,
            }}
            purpose="BALANCE"
          />
        </>
      )}
      {p.clientMobile && (
        <Button asChild size="sm" variant="outline" className="text-success">
          <a href={toWhatsAppLink(p.clientMobile, receipt)} target="_blank" rel="noreferrer">
            <ReceiptText className="size-3.5" /> Send Receipt
          </a>
        </Button>
      )}
      <EditPaymentDialog payment={p} />
      <ConfirmDeleteButton action={deletePayment} id={p.id} entityLabel="payment" />
    </div>
  );
}

export function PaymentsExplorer({
  payments,
  paymentDetails,
}: {
  payments: Payment[];
  paymentDetails: CompanyPaymentDetails;
}) {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>((params.get("filter") ?? "ALL").toUpperCase());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (q && !`${p.clientName} ${p.invoiceNumber} ${p.refNumber}`.toLowerCase().includes(q)) return false;
      const st = derivedStatus(p);
      const bucket = dayBucket(p.dueDate);
      switch (filter) {
        case "PENDING": return st === "PENDING" || st === "DUE_SOON" || st === "OVERDUE";
        case "PARTIAL": return st === "PARTIAL";
        case "PAID": return st === "PAID";
        case "TODAY": return bucket === "TODAY" && st !== "PAID";
        case "TOMORROW": return bucket === "TOMORROW" && st !== "PAID";
        case "OVERDUE": return st === "OVERDUE";
        default: return true;
      }
    });
  }, [payments, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by client, invoice / booking #..." className="sm:w-72" />
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger size="sm" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f} value={f}>{FILTER_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkActionsBar count={selected.length} entityLabel="payment" onClear={() => setSelected([])} onDelete={() => bulkDeletePayments(selected)} />

      {filtered.length === 0 ? (
        <EmptyState title="No payments found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={pageItems.length > 0 && pageItems.every((p) => selected.includes(p.id))}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked
                            ? Array.from(new Set([...prev, ...pageItems.map((p) => p.id)]))
                            : prev.filter((id) => !pageItems.some((p) => p.id === id)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Quote</TableHead>
                  <TableHead>Advance</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => {
                  const st = derivedStatus(p);
                  const balance = Math.max(p.amount - p.paidAmount, 0);
                  const days = pendingDays(p.dueDate);
                  return (
                    <TableRow key={p.id} className={cn(st === "OVERDUE" && "bg-destructive/5", st === "PAID" && "bg-success/5")}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(p.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) => (checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{p.clientName}</p>
                        <p className="text-xs text-muted-foreground">{p.refNumber}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.serviceLabel ?? "—"}
                        {(p.serviceVariant || p.packageName) && (
                          <p className="text-xs text-muted-foreground">{[p.serviceVariant, p.packageName].filter(Boolean).join(" · ")}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-sm text-success">{formatINR(p.paidAmount)}</TableCell>
                      <TableCell className="text-sm font-medium">{formatINR(balance)}</TableCell>
                      <TableCell className="text-sm">{p.mode ? PAYMENT_MODE_LABELS[p.mode] ?? p.mode : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[st] ?? "muted"}>{STATUS_LABEL[st] ?? st}</Badge>
                        {st !== "PAID" && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {days > 0 ? `${days}d overdue` : `due ${formatDate(p.dueDate)}`}
                          </p>
                        )}
                      </TableCell>
                      <TableCell><RowActions p={p} details={paymentDetails} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
