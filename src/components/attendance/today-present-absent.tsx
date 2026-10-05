"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { markTodayPresentAbsent } from "@/server/actions/attendance";
import { cn } from "@/lib/utils";

/** Francis (Operations): mark each worker Present or Absent for today — nothing else. */
export function TodayPresentAbsent({ staff, today }: { staff: { id: string; name: string }[]; today: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function mark(id: string, status: "PRESENT" | "ABSENT") {
    start(async () => {
      const res = await markTodayPresentAbsent(id, status);
      if ("error" in res && res.error) return void toast.error(res.error);
      router.refresh();
    });
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {staff.map((s) => {
        const st = today[s.id];
        return (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm font-medium">{s.name}</span>
            <span className="flex gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => mark(s.id, "PRESENT")}
                className={cn("flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold", st === "PRESENT" ? "border-success bg-success text-white" : "border-border")}
              >
                <Check className="size-3.5" /> Present
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => mark(s.id, "ABSENT")}
                className={cn("flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold", st === "ABSENT" ? "border-destructive bg-destructive text-white" : "border-border")}
              >
                <X className="size-3.5" /> Absent
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
