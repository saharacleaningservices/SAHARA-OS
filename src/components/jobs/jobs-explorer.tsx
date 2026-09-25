"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, ChevronDown } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { JobStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteJob, bulkDeleteJobs } from "@/server/actions/jobs";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { JOB_STATUSES, JOB_STATUS_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { formatDateShort, formatINR, dayBucket, cn } from "@/lib/utils";
import { buildDirectionsLink, parseMapLink } from "@/lib/maps";

type Job = {
  id: string;
  jobNumber: string;
  customerName: string;
  customerMobile: string;
  area: string;
  service: string;
  packageName?: string | null;
  serviceVariant?: string | null;
  status: string;
  scheduledDate: Date;
  scheduledTime: string;
  jobValue: number;
  teamNumber?: number | null;
  mapLink?: string | null;
  supervisor?: { name: string } | null;
  assignments: { staff: { name: string } }[];
  payments: { status: string; amount: number; paidAmount: number }[];
  vehicle?: { name: string; plateNumber: string } | null;
};

const PAGE_SIZE = 12;

function jobPaymentStatus(job: Job) {
  if (job.payments.length === 0) return null;
  if (job.payments.some((p) => p.status === "OVERDUE")) return "OVERDUE";
  if (job.payments.every((p) => p.status === "PAID")) return "PAID";
  if (job.payments.some((p) => p.status === "DUE_SOON")) return "DUE_SOON";
  return "PENDING";
}

export function JobsExplorer({ jobs, canManage = true, canSeeCustomerContact = true }: { jobs: Job[]; canManage?: boolean; canSeeCustomerContact?: boolean }) {
  const params = useSearchParams();
  const whenParam = params.get("when") ?? "";
  const statusParam = params.get("status") ?? "";
  const serviceParam = params.get("service") ?? "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusParam || "ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (q && !`${job.customerName} ${job.jobNumber} ${job.area}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "ALL" && job.status !== statusFilter) return false;
      if (whenParam === "today" && dayBucket(job.scheduledDate) !== "TODAY") return false;
      if (whenParam === "tomorrow" && dayBucket(job.scheduledDate) !== "TOMORROW") return false;
      if (serviceParam && job.service !== serviceParam) return false;      
      return true;
    });
  }, [jobs, search, statusFilter, whenParam, serviceParam]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function mapHref(job: Job) {
    if (!job.mapLink) return null;
    const c = parseMapLink(job.mapLink);
    return c ? buildDirectionsLink(c) : job.mapLink;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by customer, job #, area..." className="sm:w-72" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(whenParam || serviceParam) && (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{whenParam === "today" ? "Today" : whenParam === "tomorrow" ? "Tomorrow" : SERVICE_LABELS[serviceParam]} only ·{" "}
            <Link href="/jobs" className="underline">clear</Link>
          </span>
        )}
      </div>

      {canManage && (
        <BulkActionsBar
          count={selected.length}
          entityLabel="job"
          onClear={() => setSelected([])}
          onDelete={() => bulkDeleteJobs(selected)}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No jobs found" description="Try adjusting your search or filters." />
      ) : (
        <>
          {/* Desktop/tablet: compact table, no unnecessary horizontal scroll.
              Payment folded into the Status column (one fewer column) so
              every important field fits without scrolling on a 1366px-wide
              screen. */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={pageItems.length > 0 && pageItems.every((j) => selected.includes(j.id))}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? Array.from(new Set([...prev, ...pageItems.map((j) => j.id)]))
                              : prev.filter((id) => !pageItems.some((j) => j.id === id))
                          )
                        }
                      />
                    </TableHead>
                  )}
                  <TableHead>Job</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((job) => {
                  const isToday = dayBucket(job.scheduledDate) === "TODAY" && job.status !== "COMPLETED" && job.status !== "CANCELLED";
                  const pay = jobPaymentStatus(job);
                  const href = mapHref(job);
                  const adv = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
                  const total = job.payments.reduce((s, p) => s + (p.amount ?? 0), 0) || job.jobValue;
                  const bal = Math.max(total - adv, 0);
                  return (
                    <TableRow key={job.id} className={isToday ? "bg-success/10 ring-1 ring-inset ring-success/30" : undefined}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(job.id)}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => (checked ? [...prev, job.id] : prev.filter((id) => id !== job.id)))
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="font-medium text-foreground hover:underline">
                          {job.customerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {job.jobNumber} · {job.area}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {SERVICE_LABELS[job.service]}
                        {(job.serviceVariant || job.packageName) && (
                          <p className="text-xs text-muted-foreground">
                            {[job.serviceVariant, job.packageName].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isToday ? <span className="font-semibold text-success">Today</span> : formatDateShort(job.scheduledDate)} · {job.scheduledTime}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.teamNumber ? `T${job.teamNumber}` : "—"}
                        {job.assignments.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {job.assignments.map((a) => a.staff.name).join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap items-center gap-1">
                          <JobStatusBadge status={job.status} />
                          {pay && <PaymentStatusBadge status={pay} />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adv {formatINR(adv)} · Bal {formatINR(bal)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {canSeeCustomerContact && (
                            <>
                              <CallButton mobile={job.customerMobile} />
                              <WhatsAppButton mobile={job.customerMobile} />
                            </>
                          )}
                          {href && (
                            <Button asChild variant="outline" size="icon" className="size-8" title="Open in Maps">
                              <a href={href} target="_blank" rel="noreferrer">
                                <MapPin className="size-3.5" />
                              </a>
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button variant="outline" size="icon" className="size-8" aria-label="Edit job" asChild>
                                <Link href={`/jobs/${job.id}/edit`}>
                                  <Pencil className="size-3.5" />
                                </Link>
                              </Button>
                              <ConfirmDeleteButton action={deleteJob} id={job.id} entityLabel="job" />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: card layout, collapsed by default — tap "Details" to
              expand payment/team/service info instead of a wide table. */}
          <div className="space-y-2 sm:hidden">
            {pageItems.map((job) => {
              const isToday = dayBucket(job.scheduledDate) === "TODAY" && job.status !== "COMPLETED" && job.status !== "CANCELLED";
              const pay = jobPaymentStatus(job);
              const href = mapHref(job);
              const isOpen = expanded.has(job.id);
              const adv = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
              const total = job.payments.reduce((s, p) => s + (p.amount ?? 0), 0) || job.jobValue;
              const bal = Math.max(total - adv, 0);
              return (
                <div
                  key={job.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3",
                    isToday && "border-success/30 bg-success/5 ring-1 ring-inset ring-success/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {canManage && (
                        <Checkbox
                          className="mb-1.5"
                          checked={selected.includes(job.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) => (checked ? [...prev, job.id] : prev.filter((id) => id !== job.id)))
                          }
                        />
                      )}
                      <Link href={`/jobs/${job.id}`} className="block truncate font-medium text-foreground hover:underline">
                        {job.customerName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {job.jobNumber} · {job.area}
                      </p>
                      <p className="mt-1 text-xs text-foreground">
                        {isToday ? <span className="font-semibold text-success">Today</span> : formatDateShort(job.scheduledDate)} ·{" "}
                        {job.scheduledTime}
                        {job.teamNumber ? ` · T${job.teamNumber}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <JobStatusBadge status={job.status} />
                      {pay && <PaymentStatusBadge status={pay} />}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(job.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border pt-2 text-xs font-medium text-muted-foreground"
                  >
                    {isOpen ? "Hide details" : "Details"}
                    <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                      <p>
                        {SERVICE_LABELS[job.service]}
                        {(job.serviceVariant || job.packageName) && ` · ${[job.serviceVariant, job.packageName].filter(Boolean).join(" · ")}`}
                      </p>
                      {job.assignments.length > 0 && <p>Crew: {job.assignments.map((a) => a.staff.name).join(", ")}</p>}
                      <p>
                        Adv {formatINR(adv)} · Bal {formatINR(bal)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {canSeeCustomerContact && (
                          <>
                            <CallButton mobile={job.customerMobile} />
                            <WhatsAppButton mobile={job.customerMobile} />
                          </>
                        )}
                        {href && (
                          <Button asChild variant="outline" size="icon" className="size-8" title="Open in Maps">
                            <a href={href} target="_blank" rel="noreferrer">
                              <MapPin className="size-3.5" />
                            </a>
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button variant="outline" size="icon" className="size-8" aria-label="Edit job" asChild>
                              <Link href={`/jobs/${job.id}/edit`}>
                                <Pencil className="size-3.5" />
                              </Link>
                            </Button>
                            <ConfirmDeleteButton action={deleteJob} id={job.id} entityLabel="job" />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
