"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Plus, Loader2, Truck, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShareLocationButton } from "@/components/shared/share-location-button";
import { updateJobLocation, assignVehicle, addMaterialIssue } from "@/server/actions/jobs";
import { formatDateTime } from "@/lib/utils";

type VehicleOption = { id: string; name: string; plateNumber: string };
type MaterialRow = { id: string; item: string; quantity: string | null; issuedByName: string | null; issuedAt: Date };

export function JobLogisticsCard({
  jobId,
  mapLink,
  vehicleId,
  vehicleName,
  vehicles,
  materials,
  canEdit,
}: {
  jobId: string;
  mapLink: string | null;
  vehicleId: string | null;
  vehicleName: string | null;
  vehicles: VehicleOption[];
  materials: MaterialRow[];
  canEdit: boolean;
}) {
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submitMaterial() {
    if (!item.trim()) {
      toast.error("Enter a material name");
      return;
    }
    startTransition(async () => {
      const res = await addMaterialIssue(jobId, item, qty);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setItem("");
      setQty("");
      router.refresh();
    });
  }

  function onVehicleChange(value: string) {
    startTransition(async () => {
      await assignVehicle(jobId, value === "NONE" ? "" : value);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-4" /> Logistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Vehicle</p>
          {canEdit ? (
            <Select value={vehicleId ?? "NONE"} onValueChange={onVehicleChange} disabled={pending}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Unassigned</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} · {v.plateNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium text-foreground">{vehicleName ?? "Unassigned"}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Customer Location</p>
          {mapLink ? (
            <a href={mapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <MapPin className="size-3.5" /> Open in Google Maps
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Not shared yet</p>
          )}
          {canEdit && (
            <div className="mt-1.5">
              <ShareLocationButton onShare={(link) => updateJobLocation(jobId, link)} />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="size-3.5" /> Material Issued
          </p>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <div className="space-y-1.5">
              {materials.map((m) => (
                <div key={m.id} className="rounded-md border border-border p-2 text-sm">
                  <p className="font-medium text-foreground">
                    {m.item} {m.quantity && <span className="text-muted-foreground">× {m.quantity}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.issuedAt)} {m.issuedByName && `· ${m.issuedByName}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-2 flex gap-2">
              <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item" className="flex-1" />
              <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="w-20" />
              <Button type="button" size="icon" onClick={submitMaterial} disabled={pending} aria-label="Log material">
                {pending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
