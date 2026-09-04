"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Truck } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { createVehicle, setVehicleActive } from "@/server/actions/vehicles";

type VehicleRow = {
  id: string;
  name: string;
  plateNumber: string;
  type: string | null;
  isActive: boolean;
  _count: { jobs: number };
};

export function VehiclesExplorer({ vehicles }: { vehicles: VehicleRow[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const res = await createVehicle({ name, plateNumber: plate, type });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Vehicle added");
      setOpen(false);
      setName("");
      setPlate("");
      setType("");
      router.refresh();
    });
  }

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await setVehicleActive(id, !isActive);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Vehicle</DialogTitle>
              <DialogDescription>Used for job allocation and team logistics.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Vehicle Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tata Ace" />
              </div>
              <div className="space-y-1">
                <Label>Plate Number</Label>
                <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="MH12AB1234" />
              </div>
              <div className="space-y-1">
                <Label>Type (optional)</Label>
                <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Tempo / Bike / Van" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState title="No vehicles yet" description="Add your first vehicle to start allocating it to jobs." icon={<Truck className="size-5" />} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium text-foreground">{v.name}</TableCell>
                <TableCell className="text-sm">{v.plateNumber}</TableCell>
                <TableCell className="text-sm">{v.type ?? "—"}</TableCell>
                <TableCell className="text-sm">{v._count.jobs}</TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "success" : "muted"}>{v.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => toggle(v.id, v.isActive)} disabled={pending}>
                    {v.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
