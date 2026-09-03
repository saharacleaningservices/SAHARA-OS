"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scheduleVisit } from "@/server/actions/leads";

function defaultDateTimeLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0);
  return d.toISOString().slice(0, 16);
}

export function ScheduleVisitDialog({ leadId, trigger }: { leadId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDateTimeLocal());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const res = await scheduleVisit(leadId, date);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Site visit scheduled");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <CalendarClock className="size-3.5" /> Schedule Visit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Site Visit</DialogTitle>
          <DialogDescription>Moves this lead to the Site Visit stage.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="visit-date">Date &amp; time</Label>
          <Input id="visit-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
