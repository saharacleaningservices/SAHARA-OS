"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decideStaffRegistration } from "@/server/actions/staff-registration";

type Req = { id: string; createdAt: Date; expiresAt: Date; name: string; employeeCode: string; mobile: string; staffId: string | null };

/** Staff App registration requests (mobile verified by OTP) — Super Admin / Accounts approve. */
export function StaffRegistrationRequests({ rows }: { rows: Req[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (rows.length === 0) return null;
  const decide = (id: string, approve: boolean) =>
    start(async () => {
      const res = await decideStaffRegistration(id, approve);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(approve ? "Staff App access approved" : "Request rejected");
      router.refresh();
    });
  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4 text-primary" /> Staff App registration requests ({rows.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground">Each staff member verified their registered mobile by SMS OTP and chose their own password. Approve to enable their login.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <span className="font-mono text-xs text-muted-foreground">{r.employeeCode}</span>{" "}
                {r.staffId ? <Link href={`/staff/${r.staffId}`} className="font-medium hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                <span className="block text-xs text-muted-foreground">
                  {r.mobile} · requested {new Date(r.createdAt).toLocaleString("en-IN")}
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
