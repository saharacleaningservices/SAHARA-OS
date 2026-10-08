"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createInvoice } from "@/server/actions/quotations";
import { formatINR } from "@/lib/utils";

type LineItem = { name: string; description: string; amount: number };

/** Manual/ad-hoc invoice — for a customer not already tied to a Job (2026-09-22 master prompt §25). */
export function NewInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ name: "", description: "", amount: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const subTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const taxable = Math.max(subTotal - discount, 0);
  const gstAmount = Math.round(((taxable * gstPercent) / 100) * 100) / 100; // exact to the paisa
  const total = taxable + gstAmount;

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function reset() {
    setCustomerName("");
    setCustomerMobile("");
    setCustomerAddress("");
    setItems([{ name: "", description: "", amount: 0 }]);
    setDiscount(0);
    setGstPercent(0);
    setNotes("");
  }

  function submit() {
    startTransition(async () => {
      const res = await createInvoice({
        customerName,
        customerMobile,
        customerAddress,
        lineItems: items.filter((i) => i.name.trim()),
        discount,
        gstPercent,
        notes,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice created");
      setOpen(false);
      reset();
      router.refresh();
      if ("invoiceId" in res && res.invoiceId) {
        window.open(`/api/invoices/${res.invoiceId}/pdf`, "_blank");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileText className="size-3.5" /> Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>For a customer/job not already in the CRM billing flow.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label>Customer Name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Mobile</Label>
              <Input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Line item {idx + 1}</Label>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <Input
                value={item.name}
                onChange={(e) => updateItem(idx, { name: e.target.value })}
                placeholder="Service name"
              />
              <Input
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Description"
              />
              <Input
                type="number"
                value={item.amount}
                onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })}
                placeholder="Amount"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, { name: "", description: "", amount: 0 }])}
          >
            <Plus className="size-3.5" /> Add line item
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Discount (₹)</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">GST %</Label>
              <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(subTotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({gstPercent}%)</span>
              <span>{formatINR(gstAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !customerName.trim() || subTotal <= 0}>
            {pending && <Loader2 className="animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
