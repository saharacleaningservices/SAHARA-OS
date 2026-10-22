import Link from "next/link";

export type FunnelStage = { label: string; value: number; href?: string };

/** Share of the first stage, for bar widths (never below a visible sliver when the stage has any leads). */
export function funnelWidths(stages: FunnelStage[]): number[] {
  const top = Math.max(stages[0]?.value ?? 0, 1);
  return stages.map((s) => (s.value <= 0 ? 0 : Math.max(4, Math.round((s.value / top) * 100))));
}

/** Step conversion vs the previous stage ("—" when the previous stage is empty). */
export function stepRates(stages: FunnelStage[]): string[] {
  return stages.map((s, i) => (i === 0 ? "" : stages[i - 1].value > 0 ? `${Math.round((s.value / stages[i - 1].value) * 100)}%` : "—"));
}

/**
 * Visual conversion funnel for the Marketing dashboard (owner 2026-10-22): one bar per stage, width = share of all leads,
 * with the step conversion from the previous stage. Each bar opens the matching lead list. Plain HTML, no chart library.
 */
export function ConversionFunnel({ stages, summary }: { stages: FunnelStage[]; summary: { label: string; value: string; sub?: string }[] }) {
  const widths = funnelWidths(stages);
  const rates = stepRates(stages);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-1.5 rounded-2xl border border-border bg-card p-3 shadow-sm">
        {stages.map((s, i) => {
          const bar = (
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground sm:w-24">{s.label}</span>
              <div className="relative h-8 flex-1">
                <div
                  className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-md bg-primary/85 transition-all group-hover:bg-primary"
                  style={{ width: `${widths[i]}%`, opacity: 1 - i * 0.12 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                  <span className="rounded bg-card/80 px-1.5">{s.value}</span>
                </span>
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground" title="Conversion from the previous stage">
                {rates[i]}
              </span>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="group block rounded-lg px-1 hover:bg-muted/50" title={`Open ${s.label.toLowerCase()} leads`}>
              {bar}
            </Link>
          ) : (
            <div key={s.label} className="group px-1">
              {bar}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {summary.map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-xl font-bold">{m.value}</p>
            {m.sub && <p className="text-xs text-muted-foreground">{m.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
