"use client";

import { useEffect, useState, useTransition } from "react";
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
import { packageToQuoteItems, packageTotals, parsePackage } from "@/lib/package-calc";
import { formatINR } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { PRICING_MASTER, lineTotal, type PriceItem } from "@/lib/pricing-master";
import { getCatalogueForCrm } from "@/server/actions/pricing";

type LineItem = { name: string; description: string; amount: number };

// Individual Cleaning quantity selections carry no price. Customized
// Service items are priced automatically where a rate is configured
// (already folded into the lead's Estimated Amount, so not repeated here);
// an item with no configured rate and no unit price typed yet is recorded
// with the distinct "(price to be confirmed)" marker. ServiceQuantityFields
// records these as plain Notes lines (see
// src/components/shared/service-quantity-fields.tsx). Pull the still-
// unpriced ones back out so a freshly opened Generate Quotation dialog
// already lists exactly what the customer selected, as $0 "price to be
// confirmed" line items, so staff aren't the ones who have to remember to
// retype them. "Custom Package —" / "Customizer Package (price to be
// confirmed) —" are kept for backward compatibility with leads saved
// before the display name changed from "Customizer Package" to
// "Customized Service" (2026-09-21).
function selectionLinesFromNotes(notes?: string | null): string[] {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("Custom Package —") ||
        l.startsWith("Individual Cleaning —") ||
        l.startsWith("Customizer Package (price to be confirmed) —") ||
        l.startsWith("Customized Service (price to be confirmed) —")
    );
}

export function QuotationDialog({
  leadId,
  service,
  suggestedAmount,
  area,
  notes,
  trigger,
  serviceItems,
  discountAmount,
}: {
  leadId: string;
  service: string;
  suggestedAmount?: number | null;
  area: string;
  notes?: string | null;
  trigger?: React.ReactNode;
  /** Package Calculator lines saved on the lead — when present they become the quote lines. */
  serviceItems?: string | null;
  discountAmount?: number | null;
}) {
  const pkg = parsePackage(serviceItems, discountAmount);
  const [open, setOpen] = useState(false);
  // Live prices (Super Admin → Pricing & Packages); catalogue defaults until loaded.
  const [catalogue, setCatalogue] = useState<PriceItem[]>(PRICING_MASTER);
  useEffect(() => {
    if (open) getCatalogueForCrm().then((p) => p && setCatalogue(p.items)).catch(() => {});
  }, [open]);
  const [items, setItems] = useState<LineItem[]>(pkg.lines.length ? packageToQuoteItems(pkg) : [
    {
      name: SERVICE_LABELS[service] ?? service,
      description: `${SERVICE_LABELS[service] ?? service} at ${area}`,
      amount: suggestedAmount ?? 0,
    },
    ...selectionLinesFromNotes(notes).map((line) => ({
      name: line,
      description: `${line} — price to be confirmed`,
      amount: 0,
    })),
  ]);
  const [gstPercent, setGstPercent] = useState(0);
  const discount = pkg.lines.length ? packageTotals(pkg).discount : 0;
  const complimentary = pkg.lines.length ? packageTotals(pkg).complimentary : 0;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const subTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const taxable = Math.max(0, subTotal - discount);
  const gstAmount = Math.round((taxable * gstPercent) / 100);
  const total = taxable + gstAmount;

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function submit() {
    startTransition(async () => {
      const res = await createQuotation(leadId, items, gstPercent, discount);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quotation generated");
      setOpen(false);
      router.refresh();
      if ("quotationId" in res && res.quotationId) {
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, { name: "", description: "", amount: 0 }])}
            >
              <Plus className="size-3.5" /> Add line item
            </Button>
            {/* Same approved prices as the landing pages, booking page and catalogue (pricing master). */}
            <select
              value=""
              onChange={(e) => {
                const p = catalogue.find((x) => x.contentId === e.target.value);
                if (!p) return;
                const qty = p.minQty ?? 1;
                setItems((prev) => [
                  ...prev,
                  {
                    name: p.name,
                    description:
                      p.price == null
                        ? `${p.name} — price after inspection`
                        : `${p.name}${p.unit ? ` — ${qty} × ₹${p.price.toLocaleString("en-IN")} ${p.unit}` : ""}${p.rule ? ` (${p.rule})` : ""}`,
                    amount: lineTotal(p, qty) ?? 0,
                  },
                ]);
              }}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">+ Add from Sahara price list…</option>
              {catalogue.map((p) => (
                <option key={p.contentId} value={p.contentId}>
                  {p.name} — {p.price == null ? "after inspection" : `₹${p.price.toLocaleString("en-IN")}${p.unit ? ` ${p.unit}` : ""}`}
                </option>
              ))}
            </select>
          </div>

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
              <span className="text-muted-foreground">{complimentary > 0 || discount > 0 ? "Actual Value" : "Subtotal"}</span>
              <span>{formatINR(subTotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount (package)</span>
                <span>− {formatINR(discount)}</span>
              </div>
            )}
            {complimentary > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Complimentary (free)</span>
                <span>{formatINR(complimentary)}</span>
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
          <Button onClick={submit} disabled={pending || subTotal <= 0}>
            {pending && <Loader2 className="animate-spin" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
