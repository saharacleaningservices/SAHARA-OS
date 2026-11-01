"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { activeFestival, countdownTo, type ActiveFestival, type Countdown } from "@/lib/festival-calendar";
import { FestivalEffects, type FestivalZone } from "@/components/ui/festival-effects";

// The date is read on the visitor's device (IST maths in festival-calendar.ts), so cached / ISR pages never show a stale festival
// and there is no server↔client hydration mismatch: nothing renders until the first effect runs.
export function useActiveFestival(): ActiveFestival | null {
  const [f, setF] = useState<ActiveFestival | null>(null);
  useEffect(() => { setF(activeFestival(Date.now())); }, []);
  return f;
}

/** Drop inside any `relative overflow-hidden` section (Hero, middle block, footer): paints the current festival's canvas, or nothing. */
export function FestivalZoneEffects({ zone = "hero" }: { zone?: FestivalZone }) {
  const f = useActiveFestival();
  if (!f) return null;
  return <FestivalEffects kind={f.kind} zone={zone} />;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Sticky glassmorphic festival notice: live countdown + urgency pulse. Floats (position: fixed) under the sticky header so it never
 * shifts the layout (no CLS). Facts only — it states no slot counts, no discount and no price. Dismissible for the session.
 */
export function FestivalAnnouncement({ topClass = "top-[58px]" }: { topClass?: string }) {
  const f = useActiveFestival();
  const [left, setLeft] = useState<Countdown | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try { if (window.sessionStorage.getItem("sahara_fest_closed") === "1") setClosed(true); } catch { /* storage blocked — show it */ }
  }, []);
  useEffect(() => {
    if (!f?.upcoming) return;
    const tick = () => setLeft(countdownTo(f.targetMs));
    tick();
    const id = window.setInterval(() => { if (!document.hidden) tick(); }, 1000);
    return () => window.clearInterval(id);
  }, [f]);

  if (!f || closed) return null;
  const close = () => { setClosed(true); document.querySelector("[data-fest-spacer]")?.remove(); try { window.sessionStorage.setItem("sahara_fest_closed", "1"); } catch { /* ignore */ } };

  return (
    <div role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-0 ${topClass} z-30 flex justify-center px-3`}>
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/40 bg-[#0a2540]/70 px-3 py-1.5 text-white shadow-lg sm:py-2 shadow-black/20 backdrop-blur-md sm:px-4">
        <span className="text-xl leading-none" aria-hidden>{f.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-extrabold leading-tight sm:text-sm">
            {f.name}
            {f.upcoming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0a2540]">
                <span className="relative flex size-1.5"><span className="absolute inline-flex size-full rounded-full bg-[#0a2540] opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex size-1.5 rounded-full bg-[#0a2540]" /></span>
                Book early
              </span>
            )}
          </p>
          <p className="hidden truncate text-xs leading-tight text-white/80 sm:block">{f.line}</p>
        </div>
        {f.upcoming && left && !left.done && (
          <div className="flex shrink-0 items-center gap-1 text-center tabular-nums" aria-label={`${left.days} days ${left.hours} hours left`}>
            {([["d", left.days], ["h", left.hours], ["m", left.minutes], ["s", left.seconds]] as const).map(([u, v]) => (
              <div key={u} className="min-w-[30px] rounded-lg bg-white/15 px-1 py-0.5 ring-1 ring-white/20">
                <div className="text-sm font-extrabold leading-none">{pad(v)}</div>
                <div className="text-[8px] font-semibold uppercase text-white/70">{u}</div>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={close} aria-label="Dismiss festival notice" className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"><X className="size-4" /></button>
      </div>
    </div>
  );
}
