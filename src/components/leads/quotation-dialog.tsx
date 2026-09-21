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
import { createQuotation } from "@/server/actions/leads";
import { formatINR } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";

type LineItem = { name: string; description: string; amount: number };

// Individual Cleaning quantity selections carry no price. Customizer Package
// items are priced automatically where a rate is configured (already folded
// into the lead's Estimated Amount, so not repeated here); an item with no
// configured rate and no unit price typed yet is recorded with the distinct
// "(price to be confirmed)" marker. ServiceQuantityFields records these as
// plain Notes lines (see src/components/shared/service-quantity-fields.tsx).
// Pull the still-unpriced ones back out so a freshly opened Generate
// Quotation dialog already lists exactly what the customer selected, as $0
// "price to be confirmed" line items, so staff aren't the ones who have to
// remember to retype them. "Custom Package —" is kept for backward
// compatibility with leads saved before this fix.
function selectionLinesFromNotes(notes?: string | null): string[] {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("Custom Package —") ||
        l.startsWith("Individual Cleaning —") ||
        l.startsWith("Customizer Package (price to be confirmed) —")
    );
}

export function QuotationDialog({
  leadId,
  service,
  suggestedAmount,
  area,
  notes,
  trigger,
}: {
  leadId: string;
  service: string;
  suggestedAmount?: number | null;
  area: string;
  notes?: string | null;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    {
      name: SERVICE_LABELS[service] ?? service,
      description: `${SERVICE_LABELS[service] ?? service} at ${area}`,
      amount: suggestedAmount ?? 3999,
    },
    ...selectionLinesFromNotes(notes).map((line) => ({
      name: line,
      description: `${line} — price to be confirmed`,
      amount: 0,
    })),
  ]);
  const [gstPercent, setGstPercent] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const subTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gstAmount = Math.round((subTotal * gstPercent) / 100);
  const total = subTotal + gstAmount;

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function submit() {
    startTransition(async () => {
      const res = await createQuotation(leadId, items, gstPercent);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quotation generated");
      setOpen(false);
      router.refresh();
      if (res.quotationId) {
        window.open(`/api/quotations/${res.quotationId}/pdf`, "_blank");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <FileText className="size-3.5" /> Generate Quote
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Quotation</DialogTitle>
          <DialogDescription>Line items, GST and terms are pulled into a print-ready PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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

          <div className="flex items-center gap-3">
            <Label className="w-24 text-xs text-muted-foreground">GST %</Label>
            <Input
              type="number"
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="w-24"
            />
          </div>

          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(subTotal)}</span>
            </div>
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
          <Button onClick={submit} disabled={pending || subTotal <= 0}>
            {pending && <Loader2 className="animate-spin" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
