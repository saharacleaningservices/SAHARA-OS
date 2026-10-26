import { PageHeader } from "@/components/shared/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { listAuditLog } from "@/server/audit";
import { requireRole } from "@/lib/current-user";
import { formatDateTime } from "@/lib/utils";

const ACTION_TONE: Record<string, "muted" | "warning" | "destructive" | "success"> = {
  DELETE: "destructive",
  BULK_DELETE: "destructive",
  RESTORE: "success",
  BULK_RESTORE: "success",
  BACKUP: "muted",
  RESTORE_BACKUP: "warning",
  // A failed database restore attempt (src/app/api/backup/restore/route.ts)
  // — surfaced here now that the route logs every failure path, not just
  // successful restores.
  RESTORE_BACKUP_FAILED: "destructive",
};

export default async function AuditLogPage() {
  await requireRole(["ADMIN"]);
  const entries = await listAuditLog(200);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Every delete, restore and backup action — who, what, when." />
      {entries.length === 0 ? (
        <EmptyState title="No activity logged yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{formatDateTime(e.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={ACTION_TONE[e.action] ?? "muted"}>{e.action.replaceAll("_", " ")}</Badge>
                </TableCell>
                <TableCell className="text-sm">{e.entityType}</TableCell>
                <TableCell className="text-sm">{e.summary}</TableCell>
                <TableCell className="text-sm">{e.actorName ?? "System"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
