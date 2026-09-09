"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { officeCheckIn, officeCheckOut } from "@/server/actions/attendance";

type Row = { staffId: string; checkInTime: Date | string | null; checkOutTime: Date | string | null };
type Staff = { id: string; name: string; employeeCode: string; designation: string };

function fmt(t: Date | string | null) {
  if (!t) return null;
  return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function OfficeAttendanceClock({ rows, staff }: { rows: Row[]; staff: Staff[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byStaff = new Map(rows.map((r) => [r.staffId, r]));

  function act(fn: () => Promise<{ error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Office Check-In / Check-Out — Today</CardTitle>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active staff.</p>
        ) : (
          <div className="divide-y divide-border">
            {staff.map((s) => {
              const r = byStaff.get(s.id);
              const inT = fmt(r?.checkInTime ?? null);
              const outT = fmt(r?.checkOutTime ?? null);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inT ? `In ${inT}` : "Not checked in"}{outT ? ` · Out ${outT}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || Boolean(inT)}
                      onClick={() => act(() => officeCheckIn(s.id), `${s.name} checked in`)}
                    >
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />} In
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || !inT || Boolean(outT)}
                      onClick={() => act(() => officeCheckOut(s.id), `${s.name} checked out`)}
                    >
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />} Out
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
