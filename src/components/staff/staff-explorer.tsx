"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { AvailabilityBadge, AttendanceBadge } from "@/components/shared/status-badge";
import { AttendanceQuickActions } from "./attendance-quick-actions";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteStaff, bulkDeleteStaff } from "@/server/actions/staff";
import { formatINR } from "@/lib/utils";

type StaffRow = {
  id: string;
  employeeCode: string;
  name: string;
  mobile: string;
  designation: string;
  salaryType: string;
  dailyWage: number | null;
  monthlySalary: number | null;
  availability: string;
  attendance: { status: string }[];
  jobAssignments: { job: { jobNumber: string } }[];
};

const PAGE_SIZE = 12;

export function StaffExplorer({ staff, canViewSalary = false }: { staff: StaffRow[]; canViewSalary?: boolean }) {
  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const designations = useMemo(() => Array.from(new Set(staff.map((s) => s.designation))), [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (q && !`${s.name} ${s.employeeCode} ${s.mobile}`.toLowerCase().includes(q)) return false;
      if (designationFilter !== "ALL" && s.designation !== designationFilter) return false;
      return true;
    });
  }, [staff, search, designationFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, code, mobile..." className="sm:w-72" />
        <Select value={designationFilter} onValueChange={setDesignationFilter}>
          <SelectTrigger size="sm" className="sm:w-52">
            <SelectValue placeholder="Designation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All designations</SelectItem>
            {designations.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canViewSalary && (
        <BulkActionsBar
          count={selected.length}
          entityLabel="staff member"
          onClear={() => setSelected([])}
          onDelete={() => bulkDeleteStaff(selected)}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No staff found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {canViewSalary && (
                  <TableHead className="w-8">
                    <Checkbox
                      checked={pageItems.length > 0 && pageItems.every((s) => selected.includes(s.id))}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked
                            ? Array.from(new Set([...prev, ...pageItems.map((s) => s.id)]))
                            : prev.filter((id) => !pageItems.some((s) => s.id === id))
                        )
                      }
                    />
                  </TableHead>
                )}
                <TableHead>Staff</TableHead>
                <TableHead>Designation</TableHead>
                {canViewSalary && <TableHead>Wage</TableHead>}
                <TableHead>Availability</TableHead>
                <TableHead>Current Job</TableHead>
                <TableHead>Today</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((s) => (
                <TableRow key={s.id}>
                  {canViewSalary && (
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(s.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/staff/${s.id}`} className="font-medium text-foreground hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{s.employeeCode}</p>
                  </TableCell>
                  <TableCell className="text-sm">{s.designation}</TableCell>
                  {canViewSalary && (
                    <TableCell className="text-sm">
                      {s.salaryType === "DAILY" ? `${formatINR(s.dailyWage)}/day` : `${formatINR(s.monthlySalary)}/mo`}
                    </TableCell>
                  )}
                  <TableCell>
                    <AvailabilityBadge status={s.availability} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.jobAssignments[0]?.job.jobNumber ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.attendance[0] ? (
                      <AttendanceBadge status={s.attendance[0].status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not marked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <AttendanceQuickActions staffId={s.id} todayStatus={s.attendance[0]?.status} />
                      <CallButton mobile={s.mobile} />
                      <WhatsAppButton mobile={s.mobile} />
                      {canViewSalary && (
                        <ConfirmDeleteButton action={deleteStaff} id={s.id} entityLabel="staff member" />
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
