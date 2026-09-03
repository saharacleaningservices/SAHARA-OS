"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAttendance } from "@/server/actions/staff";

const OPTIONS: { status: "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE"; label: string; variant: "success" | "outline" | "destructive" | "secondary" }[] = [
  { status: "PRESENT", label: "P", variant: "success" },
  { status: "HALF_DAY", label: "H", variant: "outline" },
  { status: "ABSENT", label: "A", variant: "destructive" },
  { status: "LEAVE", label: "L", variant: "secondary" },
];

export function AttendanceQuickActions({ staffId, todayStatus }: { staffId: string; todayStatus?: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function mark(status: "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE") {
    startTransition(async () => {
      const res = await markAttendance(staffId, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked ${status.replace("_", " ").toLowerCase()} for today`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {pending && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      {OPTIONS.map((o) => (
        <Button
          key={o.status}
          size="icon"
          variant={todayStatus === o.status ? o.variant : "outline"}
          className="size-6 text-[10px] font-bold"
          disabled={pending}
          onClick={() => mark(o.status)}
          title={o.status}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
