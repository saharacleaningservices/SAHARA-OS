"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { staffUpdateJobStatus } from "@/server/actions/jobs";
import { cn } from "@/lib/utils";

const STEPS = ["ON_THE_WAY", "STARTED", "COMPLETED"] as const;
const ORDER = ["PENDING", "ASSIGNED", "REACTIVATED", "ON_THE_WAY", "STARTED", "COMPLETED"];

/** Assigned → On the way → Started → Completed (forward only, server-checked). */
export function StaffJobStatusButtons({ jobId, status, labels }: { jobId: string; status: string; labels: { onTheWay: string; start: string; complete: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const at = ORDER.indexOf(status);
  const label = { ON_THE_WAY: labels.onTheWay, STARTED: labels.start, COMPLETED: labels.complete };
  const nextStep = STEPS.find((s) => ORDER.indexOf(s) > at);
  return (
    <div className="grid grid-cols-3 gap-2">
      {STEPS.map((s) => {
        const done = ORDER.indexOf(s) <= at;
        const next = s === nextStep;
        return (
          <button
            key={s}
            type="button"
            disabled={done || !next || pending}
            onClick={() =>
              start(async () => {
                const res = await staffUpdateJobStatus(jobId, s);
                if ("error" in res && res.error) return void toast.error(res.error);
                router.refresh();
              })
            }
            className={cn(
              "min-h-12 rounded-xl text-sm font-bold",
              done ? "bg-success text-white" : next ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {label[s]}
          </button>
        );
      })}
    </div>
  );
}
