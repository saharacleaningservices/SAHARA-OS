"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { staffUpdateJobStatus } from "@/server/actions/jobs";
import { cn } from "@/lib/utils";

const STEPS = ["ON_THE_WAY", "STARTED", "COMPLETED"] as const;
const ORDER = ["PENDING", "ASSIGNED", "REACTIVATED", "ON_THE_WAY", "STARTED", "COMPLETED"];

/** Assigned → On the way → Started → Completed (forward only, server-checked). */
export function StaffJobStatusButtons({ jobId, status, labels, directionsHref }: { jobId: string; status: string; labels: { onTheWay: string; start: string; complete: string }; directionsHref?: string }) {
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
            onClick={() => {
              // "Start Job / Route to Site": open Google Maps right away (inside the tap, so the browser allows it).
              if (s === "ON_THE_WAY" && directionsHref) window.open(directionsHref, "_blank", "noopener");
              start(async () => {
                const res = await staffUpdateJobStatus(jobId, s);
                if ("error" in res && res.error) return void toast.error(res.error);
                toast.success(label[s]);
                router.refresh();
              });
            }}
            className={cn(
              "min-h-12 rounded-xl text-sm font-bold",
              done ? "bg-success text-white" : next ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {pending && next ? "…" : label[s]}
          </button>
        );
      })}
    </div>
  );
}
