"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * One-tap GST / Non-GST switcher for invoice, quotation and voucher forms (owner 2026-10-23). Non-GST = 0 %; GST defaults to 18 % and
 * the rate can still be changed. The parent keeps only the percentage (0 means Non-GST), so saved documents are unchanged.
 */
export function GstToggle({ value, onChange, className }: { value: number; onChange: (gstPercent: number) => void; className?: string }) {
  const on = value > 0;
  const btn = (active: boolean) => cn("h-9 flex-1 px-3 text-sm font-medium transition", active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div role="group" aria-label="GST or Non-GST" className="inline-flex overflow-hidden rounded-md border">
        <button type="button" aria-pressed={!on} className={btn(!on)} onClick={() => onChange(0)}>Non-GST</button>
        <button type="button" aria-pressed={on} className={btn(on)} onClick={() => onChange(on ? value : 18)}>GST</button>
      </div>
      {on && (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Rate
          <Input type="number" min={1} max={28} value={value} onChange={(e) => onChange(Math.min(28, Math.max(1, Number(e.target.value) || 18)))} className="h-9 w-20" aria-label="GST rate percent" />%
        </label>
      )}
    </div>
  );
}
