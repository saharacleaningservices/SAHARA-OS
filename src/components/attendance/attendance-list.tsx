"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { AttendanceBadge } from "@/components/shared/status-badge";
import { markAttendance } from "@/server/actions/attendance";
import { formatDateTime } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";

type Row = {
  id: string;
  status: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  method: string;
  staff: { id: string; name: string; employeeCode: string; designation: string };
};

export function AttendanceList({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function change(staffId: string, status: string) {
    startTransition(async () => {
      await markAttendance(staffId, status as never);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <EmptyState title="No attendance marked yet today" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead className="max-sm:hidden">Check Out</TableHead>
          <TableHead className="max-sm:hidden">Method</TableHead>
          <TableHead className={canManage ? "max-sm:hidden" : undefined}>Status</TableHead>
          {canManage && <TableHead className="text-right">Correct</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm font-medium text-foreground">
              {r.staff.name} <span className="text-xs text-muted-foreground">· {r.staff.employeeCode}</span>
            </TableCell>
            <TableCell className="text-sm">{r.checkInTime ? formatDateTime(r.checkInTime) : "—"}</TableCell>
            <TableCell className="text-sm max-sm:hidden">{r.checkOutTime ? formatDateTime(r.checkOutTime) : "—"}</TableCell>
            <TableCell className="text-sm max-sm:hidden">{r.method}</TableCell>
            <TableCell className={canManage ? "max-sm:hidden" : undefined}><AttendanceBadge status={r.status} /></TableCell>
            {canManage && (
              <TableCell className="text-right">
                <Select value={r.status} onValueChange={(v) => change(r.staff.id, v)} disabled={pending}>
                  <SelectTrigger size="sm" className="ml-auto w-28 sm:w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
