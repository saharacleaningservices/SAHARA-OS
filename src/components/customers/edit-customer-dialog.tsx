"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { upsertCustomerProfile } from "@/server/actions/customer-actions";

type CustomerProfile = {
  name: string;
  alternateMobile: string | null;
  address: string | null;
  area: string | null;
  outstandingBalance: number;
  source: string | null;
} | null;

/** Edit (or create, if none exists yet) the Customer master profile for one
 * mobile number — name/area/address/outstanding balance/source. Leaves lead
 * and job history untouched; only the additive master row Excel import also
 * writes to. */
export function EditCustomerDialog({
  mobile,
  defaultName,
  initial,
}: {
  mobile: string;
  defaultName: string;
  initial: CustomerProfile;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name || defaultName);
  const [alternateMobile, setAlternateMobile] = useState(initial?.alternateMobile ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [outstandingBalance, setOutstandingBalance] = useState(String(initial?.outstandingBalance ?? 0));
  const [source, setSource] = useState(initial?.source ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await upsertCustomerProfile(mobile, {
        name,
        alternateMobile: alternateMobile || undefined,
        address: address || undefined,
        area: area || undefined,
        outstandingBalance: Number(outstandingBalance) || 0,
        source: source || undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer profile saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Updates the customer master profile ({mobile}).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Alternate Mobile</Label>
            <Input value={alternateMobile} onChange={(e) => setAlternateMobile(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Area</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Outstanding Balance</Label>
              <Input type="number" inputMode="decimal" value={outstandingBalance} onChange={(e) => setOutstandingBalance(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
