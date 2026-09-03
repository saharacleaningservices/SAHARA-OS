"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Truck, PlayCircle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateJobStatus, completeJobWithCertificate } from "@/server/actions/jobs";
import { JOB_STATUS_LABELS } from "@/lib/constants";

const NEXT_STATUS: Record<string, { next: "ON_THE_WAY" | "STARTED" | "COMPLETED"; label: string; icon: typeof Truck }> = {
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

  if (status === "COMPLETED") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" /> Job Completed
      </span>
    );
  }

  const Icon = step?.icon ?? ClipboardCheck;

  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
