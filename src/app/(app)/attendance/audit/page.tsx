import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { requireRole } from "@/lib/current-user";
import { listAttendanceAudit } from "@/server/attendance";
import { formatDate, formatDateTime } from "@/lib/utils";

const LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
  WEEKLY_OFF: "Weekly Off",
};

export default async function AttendanceAuditPage() {
  await requireRole(["ADMIN", "OPERATIONS"]);
  const rows = await listAttendanceAudit(300);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance Audit Log" description="Every attendance change — who, when, old value → new value. Nothing is ever deleted." />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="p-6"><EmptyState title="No attendance edits yet" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Edited By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium text-foreground">{r.staffName}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm">
                      {r.oldStatus ? `${LABEL[r.oldStatus] ?? r.oldStatus} → ` : "Set "}
                      <span className="font-medium text-foreground">{LABEL[r.newStatus] ?? r.newStatus}</span>
                    </TableCell>
                    <TableCell className="text-sm">{r.editedByName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.editedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
