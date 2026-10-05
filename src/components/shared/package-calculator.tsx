"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalogueForCrm } from "@/server/actions/pricing";
import { PRICING_MASTER, type PriceItem } from "@/lib/pricing-master";
import { BASE_GROUPS, SERVICE_GROUPS, isDuplicateLine, lineAmount, newLineFromItem, packageTotals, type PackageDraft, type PackageLine } from "@/lib/package-calc";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const sel = "h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
let seq = 0;
const nid = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Package Calculator — the same component in the header utility and in
 * New Lead → Customized Service. Base package (optional) + any number of
 * service rows (Category → Service → Qty → Unit Price → Amount), subtotal,
 * discount and final amount. Unit price / discount / final are editable only
 * when canEditPrice (Super Admin / Accounts); the server re-checks this.
 */
export function PackageCalculator({
  value,
  onChange,
  canEditPrice,
  showBase = true,
}: {
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
  canEditPrice: boolean;
  showBase?: boolean;
}) {
  const [items, setItems] = useState<PriceItem[]>(PRICING_MASTER);
  useEffect(() => {
    getCatalogueForCrm().then((p) => p && setItems(p.items)).catch(() => {});
  }, []);
  // Rows being filled in (category chosen, service not yet) — not part of the package until a service is picked.
  const [pendingRows, setPendingRows] = useState<{ id: string; group: string }[]>([]);

  const baseItems = useMemo(() => items.filter((i) => BASE_GROUPS.includes(i.group) && i.price != null), [items]);
  const byGroup = (g: string) => items.filter((i) => i.group === g);
  const baseLine = value.lines.find((l) => BASE_GROUPS.includes(l.group as never));
  const serviceLines = value.lines.filter((l) => !BASE_GROUPS.includes(l.group as never));
  const t = packageTotals(value);

  const set = (lines: PackageLine[], discount = value.discount) => onChange({ lines, discount });

  function setBase(contentId: string) {
    const rest = value.lines.filter((l) => !BASE_GROUPS.includes(l.group as never));
    const item = baseItems.find((i) => i.contentId === contentId);
    set(item ? [{ ...newLineFromItem(item, nid()), qty: 1 }, ...rest] : rest);
  }
  function pickService(rowId: string, contentId: string, existing?: PackageLine) {
    const item = items.find((i) => i.contentId === contentId);
    if (!item) return;
    const line = { ...newLineFromItem(item, existing?.id ?? rowId), qty: existing ? existing.qty : Math.max(1, item.minQty ?? 1) };
    if (isDuplicateLine(value.lines, line, existing?.id)) return void toast.warning(`${item.name} with the same quantity is already added — change the quantity instead.`);
    if (existing) set(value.lines.map((l) => (l.id === existing.id ? line : l)));
    else {
      set([...value.lines, line]);
      setPendingRows((p) => p.filter((r) => r.id !== rowId));
    }
  }
  function patch(id: string, p: Partial<PackageLine>) {
    const cur = value.lines.find((l) => l.id === id);
    if (!cur) return;
    const next = { ...cur, ...p };
    if ((p.qty !== undefined || p.unitPrice !== undefined) && isDuplicateLine(value.lines, next, id)) return void toast.warning("That would duplicate an existing row — adjust this row instead.");
    set(value.lines.map((l) => (l.id === id ? next : l)));
  }
  const remove = (id: string) => set(value.lines.filter((l) => l.id !== id));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      {showBase && (
        <label className="block text-xs font-medium">
          Base package (optional)
          <select value={baseLine?.contentId ?? ""} onChange={(e) => setBase(e.target.value)} className={`${sel} mt-1`}>
            <option value="">No base package</option>
            {baseItems.map((i) => (
              <option key={i.contentId} value={i.contentId}>
                {i.name} — {inr(i.price!)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="space-y-2">
        {serviceLines.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[9rem_1fr_4.5rem_6rem_5.5rem_auto] sm:items-center">
            <span className="hidden truncate text-xs text-muted-foreground sm:block">{SERVICE_GROUPS.find((g) => g.group === l.group)?.label ?? "Other"}</span>
            <select value={l.contentId ?? ""} onChange={(e) => pickService(l.id, e.target.value, l)} className={sel} aria-label="Service">
              {byGroup(l.group).map((i) => (
                <option key={i.contentId} value={i.contentId}>{i.name}</option>
              ))}
              {!l.contentId && <option value="">{l.name}</option>}
            </select>
            <button type="button" onClick={() => remove(l.id)} className="self-center text-muted-foreground hover:text-destructive sm:order-last" aria-label={`Remove ${l.name}`}>
              <Trash2 className="size-4" />
            </button>
            <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-1 sm:contents">
              <label className="text-[11px] text-muted-foreground sm:text-sm">
                <span className="sm:hidden">Qty</span>
                <Input type="number" min={1} inputMode="numeric" value={l.qty} onChange={(e) => patch(l.id, { qty: Math.max(1, Number(e.target.value) || 1) })} className="h-9" aria-label="Quantity" />
              </label>
              <label className="text-[11px] text-muted-foreground sm:text-sm">
                <span className="sm:hidden">Unit ₹{l.unit ? ` ${l.unit}` : ""}</span>
                {canEditPrice ? (
                  <Input type="number" min={0} inputMode="decimal" value={l.unitPrice} onChange={(e) => patch(l.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} className="h-9" aria-label="Unit price" />
                ) : (
                  <span className="flex h-9 items-center text-sm text-foreground">{inr(l.unitPrice)}</span>
                )}
              </label>
              <div className="text-[11px] text-muted-foreground sm:text-right sm:text-sm">
                <span className="sm:hidden">Amount</span>
                <span className="flex h-9 items-center justify-end font-semibold text-foreground tabular-nums">{inr(lineAmount(l))}</span>
              </div>
            </div>
          </div>
        ))}

        {pendingRows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-md border border-dashed border-primary/40 bg-background p-2">
            <select value={r.group} onChange={(e) => setPendingRows((p) => p.map((x) => (x.id === r.id ? { ...x, group: e.target.value } : x)))} className={sel} aria-label="Category">
              {SERVICE_GROUPS.map((g) => (
                <option key={g.group} value={g.group}>{g.label}</option>
              ))}
            </select>
            <select value="" onChange={(e) => pickService(r.id, e.target.value)} className={sel} aria-label="Service">
              <option value="">Select service…</option>
              {byGroup(r.group).map((i) => (
                <option key={i.contentId} value={i.contentId} disabled={i.price == null && !canEditPrice}>
                  {i.name} {i.price != null ? `— ${inr(i.price)}${i.unit ? ` ${i.unit}` : ""}` : "— price on confirmation"}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setPendingRows((p) => p.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive" aria-label="Remove row">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}

        <Button type="button" size="sm" variant="outline" onClick={() => setPendingRows((p) => [...p, { id: nid(), group: "CUSTOMISED" }])}>
          <Plus className="size-3.5" /> Add Service
        </Button>
      </div>

      <div className="space-y-1.5 border-t border-border pt-2 text-sm">
        {baseLine && (
          <div className="flex justify-between gap-2 text-muted-foreground">
            <span className="truncate">{baseLine.name}</span>
            <span className="tabular-nums">{inr(lineAmount(baseLine))}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span>Subtotal ({value.lines.length} item{value.lines.length === 1 ? "" : "s"})</span>
          <span className="font-semibold tabular-nums">{inr(t.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Discount</span>
          {canEditPrice ? (
            <Input type="number" min={0} inputMode="decimal" value={value.discount || ""} placeholder="0" onChange={(e) => set(value.lines, Math.max(0, Number(e.target.value) || 0))} className="h-8 w-28 text-right" aria-label="Discount" />
          ) : (
            <span className="tabular-nums">{inr(t.discount)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-base font-bold">
          <span>Final Amount</span>
          {canEditPrice ? (
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={t.final}
              onChange={(e) => set(value.lines, Math.max(0, t.subtotal - (Number(e.target.value) || 0)))}
              className="h-9 w-32 text-right font-bold"
              aria-label="Final amount"
            />
          ) : (
            <span className="tabular-nums">{inr(t.final)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
