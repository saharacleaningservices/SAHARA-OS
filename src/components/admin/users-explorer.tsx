"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Power, Copy, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { NewUserDialog } from "@/components/admin/new-user-dialog";
import { updateUserRole, setUserActive, resetUserPassword } from "@/server/actions/users";
import { ROLE_LABELS } from "@/lib/constants";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  // Pre-formatted server-side (see admin/users/page.tsx) so the client
  // never runs its own Intl.DateTimeFormat on this value — that was
  // producing different text on the server vs. the browser's local
  // timezone and causing a hydration mismatch on this page.
  createdAtLabel: string;
};

const ROLES = ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR", "STAFF"];

export function UsersExplorer({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function changeRole(id: string, role: string) {
    startTransition(async () => {
      const res = await updateUserRole(id, role);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Role updated");
      router.refresh();
    });
  }

  function toggleActive(id: string, next: boolean) {
    startTransition(async () => {
      const res = await setUserActive(id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "User activated" : "User deactivated — they can no longer sign in");
      router.refresh();
    });
  }

  function resetPassword(id: string, name: string) {
    startTransition(async () => {
      const res = await resetUserPassword(id);
      if (res.error || !res.tempPassword) {
        toast.error(res.error ?? "Failed to reset password");
        return;
      }
      setCopied(false);
      setRevealed({ name, password: res.tempPassword });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewUserDialog />
      </div>

      {revealed && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">New temporary password for {revealed.name}</p>
            <p className="text-xs text-muted-foreground">Shown once — share it directly with them.</p>
            <code className="mt-1 block text-sm font-semibold text-foreground">{revealed.password}</code>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(revealed.password).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">
                      {u.name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email} {u.phone && `· ${u.phone}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={pending || isSelf}>
                      <SelectTrigger className="h-8 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r] ?? r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Active" : "Deactivated"}</Badge>
                      {u.mustChangePassword && (
                        <Badge variant="muted" title="Must set a new password on next login">
                          <ShieldAlert className="mr-1 size-3" /> Pending setup
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.createdAtLabel}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => resetPassword(u.id, u.name)} disabled={pending}>
                        <KeyRound className="size-3.5" /> Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(u.id, !u.isActive)}
                        disabled={pending || isSelf}
                      >
                        <Power className="size-3.5" /> {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
