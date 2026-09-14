"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Truck, Package, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateJob, assignVehicle, addMaterialIssue, sendTeamDispatch } from "@/server/actions/jobs";

type Job = { id: string; customerName: string; scheduledTime: string; jobNumber?: string };
type StaffOption = { id: string; name: string; availability: string; designation: string };
type VehicleOption = { id: string; name: string; plateNumber: string };

type DialogKind = "staff" | "vehicle" | "materials" | "whatsapp" | null;

export function QuickDispatch({
  jobs,
  staffList,
  vehicleList,
}: {
  jobs: Job[];
  staffList: StaffOption[];
  vehicleList: VehicleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<DialogKind>(null);
  const [jobId, setJobId] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [material, setMaterial] = useState({ item: "", quantity: "" });
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(null);
    setJobId("");
    setStaffIds([]);
    setVehicleId("");
    setMaterial({ item: "", quantity: "" });
  }

  function toggleStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function submitStaff() {
    if (!jobId) {
      toast.error("Pick a job first");
      return;
    }
    startTransition(async () => {
      const res = await updateJob(jobId, { staffIds });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Crew assigned");
      reset();
      router.refresh();
    });
  }

  function submitVehicle() {
    if (!jobId || !vehicleId) {
      toast.error("Pick a job and a vehicle");
      return;
    }
    startTransition(async () => {
      const res = await assignVehicle(jobId, vehicleId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Vehicle assigned");
      reset();
      router.refresh();
    });
  }

  function submitMaterial() {
    if (!jobId || !material.item.trim()) {
      toast.error("Pick a job and enter a material name");
      return;
    }
    startTransition(async () => {
      const res = await addMaterialIssue(jobId, material.item, material.quantity);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Material logged");
      reset();
      router.refresh();
    });
  }

  function submitWhatsApp() {
    if (!jobId) {
      toast.error("Pick a job first");
      return;
    }
    startTransition(async () => {
      const res = await sendTeamDispatch(jobId);
      if (!res.success) {
        toast.error(res.error ?? "Could not send");
        return;
      }
      toast.success(`Job sheet sent — ${res.sent} sent, ${res.queued} queued`);
      reset();
      router.refresh();
    });
  }

  const jobPicker = (
    <div className="space-y-1.5">
      <Label className="text-xs">Job</Label>
      <Select value={jobId} onValueChange={setJobId}>
        <SelectTrigger>
          <SelectValue placeholder="Select a job" />
        </SelectTrigger>
        <SelectContent>
          {jobs.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No jobs today</div>
          )}
          {jobs.map((j) => (
            <SelectItem key={j.id} value={j.id}>
              {j.scheduledTime} · {j.customerName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="outline" size="sm" onClick={() => setOpen("staff")}>
          <Users className="size-3.5" /> Assign Staff
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("vehicle")}>
          <Truck className="size-3.5" /> Assign Vehicle
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("materials")}>
          <Package className="size-3.5" /> Assign Materials
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("whatsapp")}>
          <MessageCircle className="size-3.5" /> WhatsApp Job Sheet
        </Button>
      </div>

      <Dialog open={open === "staff"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {jobPicker}
            <div className="space-y-1.5">
              <Label className="text-xs">Crew</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {staffList.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                    <Checkbox checked={staffIds.includes(s.id)} onCheckedChange={() => toggleStaff(s.id)} />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.designation}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitStaff} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "vehicle"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {jobPicker}
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plateNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitVehicle} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "materials"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Materials</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {jobPicker}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Item</Label>
                <Input
                  value={material.item}
                  onChange={(e) => setMaterial((m) => ({ ...m, item: e.target.value }))}
                  placeholder="e.g. Floor cleaner"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input
                  value={material.quantity}
                  onChange={(e) => setMaterial((m) => ({ ...m, quantity: e.target.value }))}
                  placeholder="e.g. 2 bottles"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitMaterial} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Log Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "whatsapp"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp Job Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {jobPicker}
            <p className="text-xs text-muted-foreground">
              Resends the job brief (customer area, service, time, vehicle, materials) to every
              crew member currently assigned to this job.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submitWhatsApp} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
