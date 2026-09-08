"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Truck, PlayCircle, CheckCircle2, ClipboardCheck, UserCheck, PauseCircle, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateJobStatus, completeJobWithCertificate } from "@/server/actions/jobs";
import { JOB_STATUS_LABELS } from "@/lib/constants";

const NEXT_STATUS: Record<string, { next: "ASSIGNED" | "ON_THE_WAY" | "STARTED" | "COMPLETED"; label: string; icon: typeof Truck }> = {
  PENDING: { next: "ASSIGNED", label: "Mark Assigned", icon: UserCheck },
  REACTIVATED: { next: "ASSIGNED", label: "Mark Assigned", icon: UserCheck },
  ASSIGNED: { next: "ON_THE_WAY", label: "Mark On the Way", icon: Truck },
  ON_THE_WAY: { next: "STARTED", label: "Mark Started", icon: PlayCircle },
  STARTED: { next: "COMPLETED", label: "Mark Completed", icon: CheckCircle2 },
};

export function StatusActions({ jobId, status }: { jobId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const step = NEXT_STATUS[status];

  function advance() {
    if (!step) return;
    startTransition(async () => {
      const res = await updateJobStatus(jobId, step.next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Status updated: ${JOB_STATUS_LABELS[step.next]}`);
      router.refresh();
    });
  }

  function completeWithCertificate() {
    startTransition(async () => {
      const res = await completeJobWithCertificate(jobId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Job completed — certificate & invoice generated");
      router.refresh();
    });
  }

  function setStatus(next: "REACTIVATED" | "POSTPONED" | "CANCELLED") {
    startTransition(async () => {
      const res = await updateJobStatus(jobId, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Status updated: ${JOB_STATUS_LABELS[next]}`);
      router.refresh();
    });
  }

  if (status === "COMPLETED") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" /> Job Completed
      </span>
    );
  }

  const Icon = step?.icon ?? ClipboardCheck;
  const offFlow = status === "POSTPONED" || status === "CANCELLED";

  return (
    <div className="flex flex-wrap gap-2">
      {offFlow ? (
        <Button size="sm" variant="outline" onClick={() => setStatus("REACTIVATED")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />}
          Reactivate Job
        </Button>
      ) : (
        <>
          {step && (
            <Button size="sm" onClick={advance} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Icon className="size-3.5" />}
              {step.label}
            </Button>
          )}
          {status === "STARTED" && (
            <Button size="sm" variant="success" onClick={completeWithCertificate} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="size-3.5" />}
              Complete &amp; Generate Certificate
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setStatus("POSTPONED")} disabled={pending}>
            <PauseCircle className="size-3.5" /> Postpone
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus("CANCELLED")} disabled={pending}>
            <XCircle className="size-3.5" /> Cancel Job
          </Button>
        </>
      )}
    </div>
  );
}
