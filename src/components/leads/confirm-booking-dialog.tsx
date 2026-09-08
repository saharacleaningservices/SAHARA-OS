"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TIME_SLOTS } from "@/lib/constants";
import { confirmBooking } from "@/server/actions/leads";
import { TeamSelect } from "@/components/shared/team-select";

type SupervisorOption = { id: string; name: string };

export function ConfirmBookingDialog({
  leadId,
  supervisors = [],
  defaultServiceDate = "",
  defaultTimeSlot = "",
  defaultTeam = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  leadId: string;
  supervisors?: SupervisorOption[];
  defaultServiceDate?: string;
  defaultTimeSlot?: string;
  defaultTeam?: number | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [serviceDate, setServiceDate] = useState(defaultServiceDate);
  const [timeSlot, setTimeSlot] = useState<string>(
    (TIME_SLOTS as readonly string[]).includes(defaultTimeSlot) ? defaultTimeSlot : ""
  );
  const [supervisorId, setSupervisorId] = useState<string>("");
  const [teamNumber, setTeamNumber] = useState<number | "">(defaultTeam ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!serviceDate || !timeSlot) {
      toast.error("Pick a service date and time slot");
      return;
    }
    startTransition(async () => {
      const res = await confirmBooking(leadId, { serviceDate, timeSlot, supervisorId, teamNumber });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking confirmed — job created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm">
              <CalendarCheck className="size-3.5" /> Confirm Booking
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Set the service date and slot. A job is created automatically and the enquiry moves to Job Scheduled.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="service-date">Service Date</Label>
            <Input
              id="service-date"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Time Slot</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger>
                <SelectValue placeholder="Select a slot" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TeamSelect value={teamNumber} onChange={setTeamNumber} label="Team (optional)" />
          {supervisors.length > 0 && (
            <div className="space-y-1">
              <Label>Supervisor (optional)</Label>
              <Select value={supervisorId || "NONE"} onValueChange={(v) => setSupervisorId(v === "NONE" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Confirm &amp; Create Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
