"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteJob, bulkDeleteJobs } from "@/server/actions/jobs";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { JOB_STATUSES, JOB_STATUS_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";

type Job = {
  id: string;
  jobNumber: string;
  customerName: string;
  customerMobile: string;
  area: string;
  service: string;
  status: string;
  scheduledDate: Date;
  scheduledTime: string;
  jobValue: number;
  teamNumber?: number | null;
  supervisor?: { name: string } | null;
  assignments: { staff: { name: string } }[];
  vehicle?: { name: string; plateNumber: string } | null;
};

const PAGE_SIZE = 12;

export function JobsExplorer({ jobs, canManage = true }: { jobs: Job[]; canManage?: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (q && !`${job.customerName} ${job.jobNumber} ${job.area}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "ALL" && job.status !== statusFilter) return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                <TableHead>Team / Crew</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((job) => (
                <TableRow key={job.id}>
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
                  <TableCell className="text-sm">{SERVICE_LABELS[job.service]}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(job.scheduledDate)} · {job.scheduledTime}
                  </TableCell>
                  <TableCell className="text-sm">
                    {job.teamNumber ? `Team ${job.teamNumber}` : job.supervisor?.name ?? "—"}
                    {job.teamNumber && job.supervisor?.name ? (
                      <span className="text-xs text-muted-foreground"> · {job.supervisor.name}</span>
                    ) : null}
                    {job.assignments.length > 0 && (
                      <span className="text-xs text-muted-foreground"> +{job.assignments.length} crew</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatINR(job.jobValue)}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <CallButton mobile={job.customerMobile} />
                      <WhatsAppButton mobile={job.customerMobile} />
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
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
