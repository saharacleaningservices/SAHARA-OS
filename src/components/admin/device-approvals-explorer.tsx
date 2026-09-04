"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { approveDevice, denyDevice } from "@/server/actions/device-approval";
import { formatDateTime } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

type DeviceRow = {
  id: string;
  label: string | null;
  ipAddress: string | null;
  status: string;
  createdAt: Date;
  lastSeenAt: Date;
  approvedByName: string | null;
  user: { name: string; email: string; role: string };
};

export function DeviceApprovalsExplorer({ pending, all }: { pending: DeviceRow[]; all: DeviceRow[] }) {
  const [pendingAction, startTransition] = useTransition();
  const router = useRouter();

  function approve(id: string) {
    startTransition(async () => {
      const res = await approveDevice(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Device approved — the user's session will start automatically");
      router.refresh();
    });
  }

  function deny(id: string) {
    startTransition(async () => {
      const res = await denyDevice(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Device denied");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="size-4" /> Awaiting your approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="No pending device logins" />
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {d.user.name} <span className="text-xs text-muted-foreground">· {ROLE_LABELS[d.user.role] ?? d.user.role}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.label ?? "Unknown device"} {d.ipAddress && `· ${d.ipAddress}`} · requested {formatDateTime(d.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(d.id)} disabled={pendingAction}>
                    <Check className="size-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deny(d.id)} disabled={pendingAction}>
                    <X className="size-3.5" /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">All devices</h2>
        {all.length === 0 ? (
          <EmptyState title="No device logins yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">
                    {d.user.name} <span className="text-xs text-muted-foreground">· {ROLE_LABELS[d.user.role] ?? d.user.role}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.label ?? "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "APPROVED" ? "success" : d.status === "DENIED" ? "destructive" : "muted"}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDateTime(d.lastSeenAt)}</TableCell>
                  <TableCell className="text-right">
                    {d.status === "APPROVED" ? (
                      <Button size="sm" variant="outline" onClick={() => deny(d.id)} disabled={pendingAction}>
                        Revoke
                      </Button>
                    ) : d.status === "DENIED" ? (
                      <Button size="sm" variant="outline" onClick={() => approve(d.id)} disabled={pendingAction}>
                        Approve
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
