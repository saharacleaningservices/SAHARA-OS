"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ReminderButtons } from "./reminder-buttons";
import { MarkPaidButton } from "./mark-paid-button";
import { computePaymentStatus, pendingDays } from "@/lib/payment-status";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";

type Payment = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientMobile: string | null;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: string;
  job?: { jobNumber: string } | null;
};

const PAGE_SIZE = 12;

const ROW_TONE: Record<string, string> = {
  PAID: "bg-success/5",
  DUE_SOON: "bg-warning/5",
  OVERDUE: "bg-destructive/5",
  PENDING: "",
};

const DOT_TONE: Record<string, string> = {
  PAID: "bg-success",
  DUE_SOON: "bg-warning",
  OVERDUE: "bg-destructive",
  PENDING: "bg-muted-foreground",
};

export function PaymentsExplorer({ payments }: { payments: Payment[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, liveStatus: computePaymentStatus(p.dueDate, p.status) })),
    [payments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((p) => {
      if (q && !`${p.clientName} ${p.invoiceNumber}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "ALL" && p.liveStatus !== statusFilter) return false;
      return true;
    });
  }, [enriched, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by client or invoice #..." className="sm:w-72" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No payments found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Pending Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => {
                const days = pendingDays(p.dueDate);
                return (
                  <TableRow key={p.id} className={cn(ROW_TONE[p.liveStatus])}>
                    <TableCell>
                      <p className="font-medium text-foreground">{p.clientName}</p>
                      {p.job && <p className="text-xs text-muted-foreground">{p.job.jobNumber}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{p.invoiceNumber}</TableCell>
                    <TableCell className="text-sm font-medium">{formatINR(p.amount)}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.dueDate)}</TableCell>
                    <TableCell className="text-sm">
                      {p.liveStatus === "PAID" ? "—" : days > 0 ? `${days}d overdue` : `${Math.abs(days)}d left`}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <span className={cn("size-2 rounded-full", DOT_TONE[p.liveStatus])} />
                        {PAYMENT_STATUS_LABELS[p.liveStatus]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {p.liveStatus !== "PAID" && (
                          <>
                            <ReminderButtons
                              paymentId={p.id}
                              clientName={p.clientName}
                              clientMobile={p.clientMobile}
                              invoiceNumber={p.invoiceNumber}
                              amount={p.amount}
                            />
                            <MarkPaidButton paymentId={p.id} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
