"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, MapPin, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerSite } from "@/server/actions/customer-sites";

export type SiteRow = { id: string; label: string | null; address: string; pinCode: string | null; area: string | null; mapLink: string | null; notes: string | null };

const blank = { label: "", address: "", pinCode: "", area: "", mapLink: "", notes: "" };

/** Service sites under one contact — list + Add / Edit (Super Admin, Accounts). */
export function CustomerSitesCard({ mobile, name, sites, canEdit }: { mobile: string; name: string; sites: SiteRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();

  function openFor(site: SiteRow | null) {
    setEditId(site?.id ?? null);
    setF(site ? { label: site.label ?? "", address: site.address, pinCode: site.pinCode ?? "", area: site.area ?? "", mapLink: site.mapLink ?? "", notes: site.notes ?? "" } : blank);
    setOpen(true);
  }
  function useLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, mapLink: `https://www.google.com/maps?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}` })),
      () => toast.error("Couldn't get your location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  function save() {
    start(async () => {
      const r = await saveCustomerSite({ mobile, name, siteId: editId ?? "", ...f });
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(editId ? "Site updated" : "Site added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="size-4 text-primary" /> Service sites <span className="text-muted-foreground">({sites.length})</span></p>
        {canEdit && (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => openFor(null)}>
            <Plus className="size-3.5" /> Add site
          </Button>
        )}
      </div>
      {sites.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No saved sites yet — they are added automatically from bookings, or add one here.</p>
      ) : (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {sites.map((s) => (
            <li key={s.id} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{s.label || "Site"}{s.area ? <span className="font-normal text-muted-foreground"> · {s.area}</span> : null}</p>
                {canEdit && (
                  <button type="button" onClick={() => openFor(s)} className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary" aria-label={`Edit ${s.label ?? "site"}`}>
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{s.address}{s.pinCode ? ` – ${s.pinCode}` : ""}</p>
              {s.notes && <p className="mt-0.5 text-xs">{s.notes}</p>}
              {s.mapLink && (
                <a href={s.mapLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <ExternalLink className="size-3" /> Google Maps
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit site" : "Add site"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2 space-y-1">
              <Label>Site name</Label>
              <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Home, Office, Client – Kharadi…" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Full address *</Label>
              <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Flat, building / society, street, landmark" />
            </div>
            <div className="space-y-1">
              <Label>Area</Label>
              <Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Kharadi" />
            </div>
            <div className="space-y-1">
              <Label>PIN code</Label>
              <Input value={f.pinCode} inputMode="numeric" maxLength={6} onChange={(e) => setF({ ...f, pinCode: e.target.value.replace(/\D/g, "") })} placeholder="411014" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Google Maps</Label>
              <div className="flex gap-2">
                <Input value={f.mapLink} onChange={(e) => setF({ ...f, mapLink: e.target.value })} placeholder="Paste Maps link" />
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={useLocation}>Current</Button>
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Site notes</Label>
              <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Gate code, parking, lift…" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={save} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} {editId ? "Save site" : "Add site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
