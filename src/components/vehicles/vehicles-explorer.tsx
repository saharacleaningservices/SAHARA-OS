"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Truck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { createVehicle, updateVehicle, setVehicleActive } from "@/server/actions/vehicles";
import { formatDate } from "@/lib/utils";

type VehicleRow = {
  id: string;
  name: string;
  plateNumber: string;
  type: string | null;
  currentKm: number | null;
  lastServiceDate: Date | null;
  nextServiceDate: Date | null;
  isActive: boolean;
  _count: { jobs: number };
};

type FormState = {
  id?: string;
  name: string;
  plateNumber: string;
  type: string;
  currentKm: string;
  lastServiceDate: string;
  nextServiceDate: string;
};

const EMPTY: FormState = { name: "", plateNumber: "", type: "", currentKm: "", lastServiceDate: "", nextServiceDate: "" };

function toDateInput(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function VehiclesExplorer({ vehicles }: { vehicles: VehicleRow[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function openAdd() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(v: VehicleRow) {
    setForm({
      id: v.id,
      name: v.name,
      plateNumber: v.plateNumber,
      type: v.type ?? "",
      currentKm: v.currentKm != null ? String(v.currentKm) : "",
      lastServiceDate: toDateInput(v.lastServiceDate),
      nextServiceDate: toDateInput(v.nextServiceDate),
    });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const res = form.id ? await updateVehicle(form.id, form) : await createVehicle(form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(form.id ? "Vehicle updated" : "Vehicle added");
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    });
  }

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await setVehicleActive(id, !isActive);
      router.refresh();
    });
  }

  const soon = Date.now() + 7 * 86400000;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="size-4" /> Add Vehicle
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
            <DialogDescription>Used for job allocation, logistics and service reminders.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Vehicle Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tata Ace" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plate Number</Label>
                <Input value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="MH12AB1234" />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Tempo / Bike / Van" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Current KM</Label>
                <Input type="number" value={form.currentKm} onChange={(e) => setForm({ ...form, currentKm: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last Service Date</Label>
                <Input type="date" value={form.lastServiceDate} onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Next Service Reminder</Label>
              <Input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {vehicles.length === 0 ? (
        <EmptyState title="No vehicles yet" description="Add your first vehicle to start allocating it to jobs." icon={<Truck className="size-5" />} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Last Service</TableHead>
                <TableHead>Next Service</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => {
                const due = v.nextServiceDate && new Date(v.nextServiceDate).getTime() <= soon;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-foreground">
                      {v.name}
                      {v.type ? <span className="ml-1 text-xs text-muted-foreground">· {v.type}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">{v.plateNumber}</TableCell>
                    <TableCell className="text-sm">{v.currentKm != null ? v.currentKm.toLocaleString("en-IN") : "—"}</TableCell>
                    <TableCell className="text-sm">{v.lastServiceDate ? formatDate(v.lastServiceDate) : "—"}</TableCell>
                    <TableCell className="text-sm">
                      {v.nextServiceDate ? (
                        <span className="flex items-center gap-1.5">
                          {formatDate(v.nextServiceDate)}
                          {due && <Badge variant="warning" className="text-[10px]">Service due</Badge>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{v._count.jobs}</TableCell>
                    <TableCell>
                      <Badge variant={v.isActive ? "success" : "muted"}>{v.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" className="size-8" onClick={() => openEdit(v)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggle(v.id, v.isActive)} disabled={pending}>
                          {v.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
