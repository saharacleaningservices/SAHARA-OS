"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Truck, PlayCircle, CheckCircle2, UserCheck, XCircle, RotateCcw, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateJobStatus, completeJobWithCertificate, rescheduleJob } from "@/server/actions/jobs";
import { JOB_STATUS_LABELS, TIME_SLOTS } from "@/lib/constants";

type Status = "PENDING" | "ASSIGNED" | "ON_THE_WAY" | "STARTED" | "COMPLETED" | "POSTPONED" | "CANCELLED" | "REACTIVATED";

/**
 * Job lifecycle actions (office): Scheduled → On the Way → Work Started → Work Complete,
 * with Reschedule (same job, new date/time) and Cancel available until completion.
 * "Postpone" is replaced by Reschedule; Work Complete is the single completion path
 * (certificate + invoice + review), so a job can't be completed twice.
 */
export function StatusActions({ jobId, status, scheduledDate, scheduledTime }: { jobId: string; status: string; scheduledDate?: string; scheduledTime?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [time, setTime] = useState(scheduledTime ?? "");
  const [reason, setReason] = useState("");
  const s = status as Status;

  function run(fn: () => Promise<{ error?: string } | { success: true }>, ok: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(ok);
      after?.();
      router.refresh();
    });
  }
  const setStatus = (next: Status) => run(() => updateJobStatus(jobId, next), `Status updated: ${JOB_STATUS_LABELS[next] ?? next}`);
  const cancel = () => {
    if (confirm("Cancel this job? The customer and assigned team are informed.")) setStatus("CANCELLED");
  };

  if (s === "COMPLETED") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" /> Job Completed
      </span>
    );
  }
  if (s === "CANCELLED") {
    return (
      <Button size="sm" variant="outline" onClick={() => setStatus("REACTIVATED")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />} Reactivate Job
      </Button>
    );
  }

  const slots: readonly string[] = TIME_SLOTS.includes(time as never) || !time ? TIME_SLOTS : [time, ...TIME_SLOTS];
  const canReschedule = s !== "STARTED";

  return (
    <div className="flex flex-wrap gap-2">
      {(s === "PENDING" || s === "REACTIVATED") && (
        <Button size="sm" onClick={() => setStatus("ASSIGNED")} disabled={pending}>
          <UserCheck className="size-3.5" /> Mark Scheduled
        </Button>
      )}
      {(s === "ASSIGNED" || s === "PENDING" || s === "REACTIVATED") && (
        <Button size="sm" variant={s === "ASSIGNED" ? "default" : "outline"} onClick={() => setStatus("ON_THE_WAY")} disabled={pending}>
          <Truck className="size-3.5" /> Mark On the Way
        </Button>
      )}
      {(s === "ASSIGNED" || s === "ON_THE_WAY") && (
        <Button size="sm" variant={s === "ON_THE_WAY" ? "default" : "outline"} onClick={() => setStatus("STARTED")} disabled={pending}>
          <PlayCircle className="size-3.5" /> Work Started
        </Button>
      )}
      {s === "STARTED" && (
        <Button size="sm" variant="success" onClick={() => run(() => completeJobWithCertificate(jobId), "Job completed — certificate & invoice generated")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-3.5" />} Work Complete
        </Button>
      )}
      {canReschedule && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
          <CalendarClock className="size-3.5" /> Reschedule
        </Button>
      )}
      <Button size="sm" variant="outline" className="text-destructive" onClick={cancel} disabled={pending}>
        <XCircle className="size-3.5" /> Cancel Job
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule job</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Moves this same job — the enquiry, job list, calendar, dashboard, customer and assigned team are updated. No new job is created.</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-date">New date</Label>
              <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-time">New time slot</Label>
              <select id="rs-time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Select a slot</option>
                {slots.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-reason">Reason (optional)</Label>
              <Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer asked for Sunday" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button disabled={pending || !date || !time} onClick={() => run(() => rescheduleJob(jobId, date, time, reason), "Job rescheduled", () => setOpen(false))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Save new date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
