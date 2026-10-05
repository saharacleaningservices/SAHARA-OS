"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decideStaffPinReset } from "@/server/actions/staff-pin-reset";

type Req = { id: string; createdAt: Date; expiresAt: Date; name: string; employeeCode: string; staffId: string | null };

/** Password Reset Requests — Super Admin / Accounts. Call the staff member to confirm before approving. */
export function PinResetRequests({ rows }: { rows: Req[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (rows.length === 0) return null;
  const decide = (id: string, approve: boolean) =>
    start(async () => {
      const res = await decideStaffPinReset(id, approve);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(approve ? "New PIN approved" : "Request rejected");
      router.refresh();
    });
  return (
    <Card className="border-warning/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-warning" /> Password reset requests ({rows.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground">Call the staff member on their registered mobile to confirm before approving. Requests expire automatically.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <span className="font-mono text-xs text-muted-foreground">{r.employeeCode}</span>{" "}
                {r.staffId ? <Link href={`/staff/${r.staffId}`} className="font-medium hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                <span className="block text-xs text-muted-foreground">
                  Requested {new Date(r.createdAt).toLocaleString("en-IN")} · expires {new Date(r.expiresAt).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" disabled={pending} onClick={() => decide(r.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
