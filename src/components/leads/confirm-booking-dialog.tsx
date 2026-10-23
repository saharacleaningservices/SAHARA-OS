"use client";

import { useEffect, useState, useTransition } from "react";
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
import { getTeamRosters, type TeamRoster } from "@/server/actions/team-roster";

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
  defaultOpen = false,
}: {
  leadId: string;
  supervisors?: SupervisorOption[];
  defaultServiceDate?: string;
  defaultTimeSlot?: string;
  defaultTeam?: number | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Opened straight away (Package Calculator → Save & Confirm Booking). */
  defaultOpen?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [serviceDate, setServiceDate] = useState(defaultServiceDate);
  const [timeSlot, setTimeSlot] = useState<string>(
    (TIME_SLOTS as readonly string[]).includes(defaultTimeSlot) ? defaultTimeSlot : ""
  );
  const [supervisorId, setSupervisorId] = useState<string>("");
  const [teamNumber, setTeamNumber] = useState<number | "">(defaultTeam ?? "");
  const [rosters, setRosters] = useState<TeamRoster[]>([]);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  useEffect(() => {
    if (open && rosters.length === 0) getTeamRosters().then(setRosters).catch(() => {});
  }, [open, rosters.length]);
  const pickTeam = (n: number | "") => {
    setTeamNumber(n);
    setStaffIds(n ? (rosters.find((r) => r.team === n)?.crew.map((c) => c.id) ?? []) : []);
  };
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!serviceDate || !timeSlot) {
      toast.error("Pick a service date and time slot");
      return;
    }
    startTransition(async () => {
      const res = await confirmBooking(leadId, { serviceDate, timeSlot, supervisorId, teamNumber, staffIds });
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
            Set the service date, slot and team. One save confirms the booking, creates the job and assigns the crew.
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
          <div className="space-y-1.5">
            <Label>Team (optional) — the crew is assigned with the booking</Label>
            <div className="grid gap-1.5" role="radiogroup" aria-label="Team">
              {[{ team: 0, crew: [] as { id: string; name: string }[] }, ...(rosters.length ? rosters : [1, 2, 3, 4].map((team) => ({ team, crew: [] as { id: string; name: string }[] })))].map((r) => {
                const active = (teamNumber || 0) === r.team;
                return (
                  <button
                    key={r.team}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickTeam(r.team === 0 ? "" : r.team)}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition ${active ? "border-primary bg-primary/5 font-semibold" : "hover:bg-muted/50"}`}
                  >
                    {r.team === 0 ? "Unassigned" : `Team ${r.team}`}
                    {r.team !== 0 && <span className="font-normal text-muted-foreground">{r.crew.length ? `: ${r.crew.map((c) => c.name).join(", ")}` : " — no crew yet"}</span>}
                  </button>
                );
              })}
            </div>
          </div>
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
