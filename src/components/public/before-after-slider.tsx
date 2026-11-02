"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

/**
 * Interactive before/after comparison (Phase 2, 2026-11-02). Drag the handle (mouse, touch or pen — pointer capture keeps the
 * drag smooth even outside the photo), tap anywhere to jump, or use ← / → / Home / End on the focused handle. Both photos are
 * the same size and stacked; only a clip-path changes, so there is no reflow and no layout shift. Lazy-loaded images.
 */
export function BeforeAfterSlider({ before, after, alt, caption, initial = 50 }: { before: string; after: string; alt: string; caption?: string | null; initial?: number }) {
  const [pos, setPos] = useState(initial);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromEvent = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#0a2540]/5">
      <div
        ref={box}
        className="relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden"
        onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); fromEvent(e.clientX); }}
        onPointerMove={(e) => dragging.current && fromEvent(e.clientX)}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`${alt} — after`} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`${alt} — before`} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-extrabold text-white">BEFORE</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary/85 px-2 py-0.5 text-[11px] font-extrabold text-white">AFTER</span>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,.35)]" style={{ left: `${pos}%` }} />
        <button
          type="button"
          role="slider"
          aria-label={`Compare before and after: ${alt}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% before`}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 4;
            if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
            else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
            else if (e.key === "Home") setPos(0);
            else if (e.key === "End") setPos(100);
            else return;
            e.preventDefault();
          }}
          className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-primary shadow-lg ring-2 ring-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          style={{ left: `${pos}%` }}
        >
          <ChevronsLeftRight className="size-5" />
        </button>
      </div>
      {caption && <figcaption className="px-3 py-2 text-xs text-[#0a2540]/70">{caption}</figcaption>}
    </figure>
  );
}
