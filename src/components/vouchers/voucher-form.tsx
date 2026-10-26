"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GstToggle } from "@/components/shared/gst-toggle";
import { createVoucherAction } from "@/server/actions/vouchers";
import { VOUCHER_META, voucherTotals, type VoucherLine, type VoucherType } from "@/lib/vouchers";
import { formatINR } from "@/lib/utils";

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** "+ Create …" dialog for one voucher type. Delivery challans take quantities only; everything else has rates and the GST / Non-GST switch. */
export function NewVoucherDialog({ type }: { type: VoucherType }) {
  const meta = VOUCHER_META[type];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [party, setParty] = useState({ name: "", mobile: "", gstin: "", address: "", ref: "", notes: "" });
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>([{ name: "", qty: 1, rate: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const totals = voucherTotals(lines, discount, gstPercent > 0, gstPercent);
  const set = (i: number, patch: Partial<VoucherLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const save = () =>
    start(async () => {
      const res = await createVoucherAction({
        type,
        voucherDate: date,
        partyName: party.name,
        partyMobile: party.mobile || undefined,
        partyGstin: party.gstin || undefined,
        partyAddress: party.address || undefined,
        refNumber: party.ref || undefined,
        lines: lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name, qty: Number(l.qty) || 1, rate: Number(l.rate) || 0 })),
        discount,
        isGst: gstPercent > 0,
        gstPercent,
        dueDate: dueDate || undefined,
        notes: party.notes || undefined,
      });
      if (!res.success) return void toast.error(res.error);
      toast.success(`${res.number} created`);
      setOpen(false);
      setParty({ name: "", mobile: "", gstin: "", address: "", ref: "", notes: "" });
      setLines([{ name: "", qty: 1, rate: 0 }]);
      setDiscount(0);
      setGstPercent(0);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Create {meta.label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New {meta.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">{type === "PURCHASE" ? "Vendor name" : "Party name"}</Label><Input value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Mobile</Label><Input type="tel" inputMode="numeric" value={party.mobile} onChange={(e) => setParty({ ...party, mobile: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">GSTIN (optional)</Label><Input value={party.gstin} onChange={(e) => setParty({ ...party, gstin: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Address (optional)</Label><Input value={party.address} onChange={(e) => setParty({ ...party, address: e.target.value })} /></div>
            {type === "CREDIT_NOTE" && <div className="space-y-1"><Label className="text-xs">Against invoice no.</Label><Input value={party.ref} onChange={(e) => setParty({ ...party, ref: e.target.value })} /></div>}
            {type === "PURCHASE" && <div className="space-y-1"><Label className="text-xs">Vendor bill no.</Label><Input value={party.ref} onChange={(e) => setParty({ ...party, ref: e.target.value })} /></div>}
            {(type === "PURCHASE" || type === "PROFORMA") && <div className="space-y-1"><Label className="text-xs">Due date (optional)</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Items</Label>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_92px_32px] items-center gap-1.5">
                <Input placeholder="Item / service" value={l.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Item name" />
                <Input type="number" min={1} value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} aria-label="Quantity" />
                {meta.hasMoney ? <Input type="number" min={0} value={l.rate} onChange={(e) => set(i, { rate: Number(e.target.value) })} aria-label="Rate" /> : <span />}
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : ls))} aria-label="Remove item"><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { name: "", qty: 1, rate: 0 }])}><Plus className="size-3.5" /> Add item</Button>
          </div>

          {meta.hasMoney && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <GstToggle value={gstPercent} onChange={setGstPercent} />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">Discount ₹ <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-9 w-24" /></label>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sub total</span><span>{formatINR(totals.subTotal)}</span></div>
              {totals.gstAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST ({gstPercent}%)</span><span>{formatINR(totals.gstAmount)}</span></div>}
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(totals.totalAmount)}</span></div>
            </div>
          )}

          <div className="space-y-1"><Label className="text-xs">Notes (optional)</Label><Input value={party.notes} onChange={(e) => setParty({ ...party, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={save} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save {meta.label}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
