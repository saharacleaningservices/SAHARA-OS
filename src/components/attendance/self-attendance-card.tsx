"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selfCheckIn, selfCheckOut } from "@/server/actions/attendance";
import { formatDateTime } from "@/lib/utils";

export function SelfAttendanceCard({
  checkInTime,
  checkOutTime,
  method,
}: {
  checkInTime: Date | null;
  checkOutTime: Date | null;
  method: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function doCheckIn() {
    // GPS-ready: captures coordinates when the device/browser allows it,
    // falls back to a plain manual check-in otherwise — either way the
    // check-in is recorded.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      startTransition(async () => {
        await selfCheckIn(null, null);
        router.refresh();
      });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        startTransition(async () => {
          await selfCheckIn(pos.coords.latitude, pos.coords.longitude);
          toast.success("Checked in");
          router.refresh();
        });
      },
      () => {
        setBusy(false);
        startTransition(async () => {
          await selfCheckIn(null, null);
          toast.success("Checked in (location unavailable)");
          router.refresh();
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function doCheckOut() {
    startTransition(async () => {
      await selfCheckOut();
      toast.success("Checked out");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Check In</p>
            <p className="font-medium text-foreground">{checkInTime ? formatDateTime(checkInTime) : "Not yet"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Check Out</p>
            <p className="font-medium text-foreground">{checkOutTime ? formatDateTime(checkOutTime) : "Not yet"}</p>
          </div>
        </div>
        {method === "GPS" && (
          <p className="flex items-center gap-1 text-xs text-success"><MapPin className="size-3" /> Location captured</p>
        )}
        <div className="flex gap-2">
          <Button onClick={doCheckIn} disabled={busy || pending || Boolean(checkInTime)}>
            {busy || pending ? <Loader2 className="animate-spin" /> : <LogIn className="size-4" />} Check In
          </Button>
          <Button
            variant="outline"
            onClick={doCheckOut}
            disabled={pending || !checkInTime || Boolean(checkOutTime)}
          >
            {pending ? <Loader2 className="animate-spin" /> : <LogOut className="size-4" />} Check Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
