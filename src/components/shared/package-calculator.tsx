"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Gift, Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCatalogueForCrm } from "@/server/actions/pricing";
import { PRICING_MASTER, activeCampaign, unitPriceFor, upcomingFestivals, type FestivalWindow, type PriceItem } from "@/lib/pricing-master";
import {
  BASE_GROUPS,
  DISCOUNT_PRESETS,
  SERVICE_GROUPS,
  isDuplicateLine,
  lineAmount,
  newLineFromItem,
  packageTotals,
  percentDiscount,
  type PackageDraft,
  type PackageLine,
} from "@/lib/package-calc";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; // exact — paise only when present
const sel = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
const chip = "h-8 rounded-full border px-3 text-xs font-semibold transition-colors";
let seq = 0;
const nid = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;
const todayYmd = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const isBase = (l: PackageLine) => BASE_GROUPS.includes(l.group as never);

/**
 * Package Calculator — header/Customers dialog and New Lead → Customized Service.
 * Master prices only (Regular or an approved Festival price). Actual Value
 * (chargeable lines) − Discount = Final Payable; complimentary lines are shown
 * with their value but never charged or discounted. Discount and complimentary
 * are Super Admin / Accounts only (canEditPrice) — the server re-checks both.
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
  const [festivals, setFestivals] = useState<FestivalWindow[]>([]);
  const [festivalId, setFestivalId] = useState("");
  useEffect(() => {
    getCatalogueForCrm()
      .then((p) => {
        if (!p) return;
        setItems(p.items);
        setFestivals(upcomingFestivals(p.festivals, todayYmd()));
        // Festival campaign running: new packages start at the exact festival price (staff can still pick
        // Regular for non-festival dates). Existing saved lines are never re-priced here.
        const c = activeCampaign(p.festivals, todayYmd());
        if (c && value.lines.length === 0) setFestivalId(c.current.id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; the festival default only applies to an empty package
  }, []);
  const festival = festivals.find((f) => f.id === festivalId) ?? null;
  const priceOf = (i: PriceItem) => unitPriceFor(i, festival);

  const [addGroup, setAddGroup] = useState<string>("CUSTOMISED");
  const [customOpen, setCustomOpen] = useState(false);

  const baseItems = useMemo(() => items.filter((i) => BASE_GROUPS.includes(i.group) && i.price != null), [items]);
  const byGroup = (g: string) => items.filter((i) => i.group === g);
  const baseLine = value.lines.find(isBase);
  const serviceLines = value.lines.filter((l) => !isBase(l));
  const t = packageTotals(value);
  const pct = t.subtotal > 0 ? Math.round((t.discount / t.subtotal) * 1000) / 10 : 0;

  // Discount is a fixed ₹ amount; a preset % is re-applied when lines change so it stays consistent.
  const [presetPct, setPresetPct] = useState<number | null>(null);
  const emit = (lines: PackageLine[], discount = value.discount, preset = presetPct) => {
    const sub = packageTotals({ lines, discount: 0 }).subtotal;
    onChange({ lines, discount: preset != null ? percentDiscount(sub, preset) : Math.min(discount, sub) });
  };

  function line(item: PriceItem, id: string, qty?: number): PackageLine {
    return { ...newLineFromItem(item, id), unitPrice: priceOf(item) ?? 0, ...(qty ? { qty } : {}) };
  }
  function switchFestival(id: string) {
    setFestivalId(id);
    const f = festivals.find((x) => x.id === id) ?? null;
    const byId = new Map(items.map((i) => [i.contentId, i]));
    emit(value.lines.map((l) => {
      const it = l.contentId ? byId.get(l.contentId) : undefined;
      const p = it ? unitPriceFor(it, f) : null;
      return p != null ? { ...l, unitPrice: p } : l;
    }));
  }
  function setBase(contentId: string) {
    const item = baseItems.find((i) => i.contentId === contentId);
    emit(item ? [{ ...line(item, nid()), qty: 1 }, ...serviceLines] : serviceLines);
  }
  function addService(contentId: string) {
    const item = items.find((i) => i.contentId === contentId);
    if (!item) return;
    const l = line(item, nid());
    if (isDuplicateLine(value.lines, l)) return void toast.warning(`${item.name} is already added — change its quantity instead.`);
    emit([...value.lines, l]);
  }
  function patch(id: string, p: Partial<PackageLine>) {
    const cur = value.lines.find((l) => l.id === id);
    if (!cur) return;
    const next = { ...cur, ...p };
    if (p.qty !== undefined && isDuplicateLine(value.lines, next, id)) return void toast.warning("That would duplicate an existing row.");
    emit(value.lines.map((l) => (l.id === id ? next : l)));
  }
  const remove = (id: string) => emit(value.lines.filter((l) => l.id !== id));
  function preset(p: number | null) {
    setCustomOpen(false);
    setPresetPct(p);
    emit(value.lines, 0, p);
  }

  return (
    <div className="space-y-3">
      {festivals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Price list">
          <button type="button" onClick={() => switchFestival("")} className={cn(chip, !festival ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>Regular</button>
          {festivals.map((f) => (
            <button key={f.id} type="button" onClick={() => switchFestival(f.id)} className={cn(chip, festival?.id === f.id ? "border-amber-500 bg-amber-500 text-white" : "bg-background")}>
              🎉 {f.name}
            </button>
          ))}
        </div>
      )}

      {showBase && (
        <label className="block text-xs font-medium text-muted-foreground">
          Package
          <select value={baseLine?.contentId ?? ""} onChange={(e) => setBase(e.target.value)} className={`${sel} mt-1 text-foreground`}>
            <option value="">No base package (services only)</option>
            {baseItems.map((i) => (
              <option key={i.contentId} value={i.contentId}>
                {i.name} — {inr(priceOf(i) ?? 0)}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Selected services — one compact row each */}
      {serviceLines.length > 0 && (
        <ul className="divide-y rounded-lg border bg-background">
          {serviceLines.map((l) => (
            <li key={l.id} className={cn("px-2.5 py-2", l.complimentary && "bg-emerald-50 dark:bg-emerald-950/30")}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium leading-snug">{l.name}</p>
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", l.complimentary && "text-emerald-700 line-through decoration-1 dark:text-emerald-400")}>{inr(lineAmount(l))}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground tabular-nums">
                  {inr(l.unitPrice)}{l.unit ? ` ${l.unit}` : ""}
                  {l.complimentary && <span className="ml-1 font-semibold text-emerald-700 dark:text-emerald-400">· Complimentary</span>}
                </p>
                <div className="flex shrink-0 items-center rounded-md border bg-background">
                  <button type="button" className="grid size-8 place-items-center text-muted-foreground" aria-label="Decrease quantity" onClick={() => patch(l.id, { qty: Math.max(1, l.qty - 1) })}><Minus className="size-3.5" /></button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => patch(l.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-8 w-10 border-x bg-transparent text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={`${l.name} quantity`}
                  />
                  <button type="button" className="grid size-8 place-items-center text-muted-foreground" aria-label="Increase quantity" onClick={() => patch(l.id, { qty: l.qty + 1 })}><Plus className="size-3.5" /></button>
                </div>
                {canEditPrice && (
                  <button
                    type="button"
                    onClick={() => patch(l.id, { complimentary: !l.complimentary })}
                    className={cn("grid size-8 shrink-0 place-items-center rounded-md border", l.complimentary ? "border-emerald-600 bg-emerald-600 text-white" : "text-muted-foreground hover:text-emerald-700")}
                    aria-label={l.complimentary ? `Charge ${l.name}` : `Make ${l.name} complimentary`}
                    aria-pressed={!!l.complimentary}
                    title="Complimentary (free, value shown)"
                  >
                    <Gift className="size-4" />
                  </button>
                )}
                <button type="button" onClick={() => remove(l.id)} className="grid size-8 shrink-0 place-items-center text-muted-foreground hover:text-destructive" aria-label={`Remove ${l.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add a service: category → service (adds immediately) */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <select value={addGroup} onChange={(e) => setAddGroup(e.target.value)} className={sel} aria-label="Category">
          {SERVICE_GROUPS.map((g) => (
            <option key={g.group} value={g.group}>{g.label}</option>
          ))}
        </select>
        <select value="" onChange={(e) => addService(e.target.value)} className={sel} aria-label="Add service">
          <option value="">+ Add service…</option>
          {byGroup(addGroup).map((i) => {
            const p = priceOf(i);
            return (
              <option key={i.contentId} value={i.contentId} disabled={p == null}>
                {i.name} {p != null ? `— ${inr(p)}${i.unit ? ` ${i.unit}` : ""}` : "— price on confirmation"}
              </option>
            );
          })}
        </select>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
        <Row label={`Actual Value (${value.lines.filter((l) => !l.complimentary).length} item${value.lines.filter((l) => !l.complimentary).length === 1 ? "" : "s"})`} value={inr(t.subtotal)} />
        {canEditPrice ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-auto text-muted-foreground">Discount</span>
              <button type="button" onClick={() => preset(null)} className={cn(chip, t.discount === 0 && !customOpen ? "border-primary bg-primary/10 text-primary" : "bg-background")}>None</button>
              {DISCOUNT_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => preset(p)} className={cn(chip, presetPct === p ? "border-primary bg-primary/10 text-primary" : "bg-background")}>{p}%</button>
              ))}
              <button type="button" onClick={() => { setPresetPct(null); setCustomOpen(true); }} className={cn(chip, customOpen || (t.discount > 0 && presetPct == null) ? "border-primary bg-primary/10 text-primary" : "bg-background")}>Custom</button>
            </div>
            {(customOpen || (t.discount > 0 && presetPct == null)) && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={value.discount || ""}
                  placeholder="0"
                  onChange={(e) => emit(value.lines, Math.max(0, Number(e.target.value) || 0), null)}
                  className="h-9 w-28 text-right"
                  aria-label="Custom discount amount"
                />
              </div>
            )}
          </div>
        ) : null}
        {t.discount > 0 && <Row label={`Discount${pct ? ` (${pct}%)` : ""}`} value={`− ${inr(t.discount)}`} />}
        {t.complimentary > 0 && <Row label="Complimentary (free)" value={inr(t.complimentary)} tone="text-emerald-700 dark:text-emerald-400" />}
        <div className="flex items-center justify-between border-t pt-1.5 text-base font-bold">
          <span>Final Payable</span>
          <span className="tabular-nums">{inr(t.final)}</span>
        </div>
        {t.discount + t.complimentary > 0 && <p className="text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400">Customer saves {inr(t.discount + t.complimentary)}</p>}
        {festival && <p className="text-[11px] text-muted-foreground">{festival.name} prices ({festival.start} → {festival.end}).</p>}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={cn("flex justify-between gap-2", tone)}>
      <span className={tone ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
