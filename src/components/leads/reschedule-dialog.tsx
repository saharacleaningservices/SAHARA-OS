"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TIME_SLOTS } from "@/lib/constants";
import { rescheduleJob } from "@/server/actions/jobs";
import { rescheduleLead } from "@/server/actions/leads";

/**
 * Reschedule Date / Time. A booked enquiry reschedules its JOB (crew and customer messages follow); an enquiry without a job changes its
 * requested date / slot. `primary` styles it as the page's single main action.
 */
export function RescheduleDialog({ leadId, jobId, defaultDate = "", defaultSlot = "", label = "Reschedule Date/Time", primary = false }: { leadId: string; jobId: string | null; defaultDate?: string; defaultSlot?: string; label?: string; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [slot, setSlot] = useState((TIME_SLOTS as readonly string[]).includes(defaultSlot) ? defaultSlot : "");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = jobId ? await rescheduleJob(jobId, date, slot, reason) : await rescheduleLead(leadId, date, slot);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(jobId ? "Job rescheduled" : "Requested date and time updated");
      setOpen(false);
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={primary ? "default" : "outline"}>
          <CalendarClock className="size-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{jobId ? "The job moves to the new date and slot; the crew is notified." : "Updates the requested service date and slot on this enquiry."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="rs-date">New date</Label>
            <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Time slot</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger><SelectValue placeholder="Select a slot" /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {jobId && (
            <div className="space-y-1">
              <Label htmlFor="rs-reason">Reason (optional)</Label>
              <Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={pending || !date || !slot}>
            {pending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
