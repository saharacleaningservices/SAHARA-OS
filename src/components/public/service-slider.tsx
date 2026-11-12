"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type SliderSlide = { src: string; alt: string; label?: string };

const ROTATE_MS = 4000;

/**
 * Category-specific image slider for the right column of the service-page split hero (owner 2026-11-12).
 * Cross-fading stack with a fixed aspect ratio (no layout shift): auto-plays, pauses on hover / touch / keyboard focus,
 * has arrows + dots, and shows a clear Before / After / Our equipment pill. Autoplay is off for reduced-motion visitors.
 */
export function ServiceSlider({ slides, className = "" }: { slides: SliderSlide[]; className?: string }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const many = slides.length > 1;

  useEffect(() => {
    if (!many || hold) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % slides.length); }, ROTATE_MS);
    return () => clearInterval(id);
  }, [many, hold, slides.length]);

  const go = (n: number) => setI(((n % slides.length) + slides.length) % slides.length);
  const cur = slides[i];

  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-[#0a2540]/5 shadow-md ring-1 ring-[#0a2540]/10 ${className}`}
      role="group"
      aria-roledescription="carousel"
      aria-label="Before and after results and our equipment"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onTouchStart={() => setHold(true)}
      onTouchEnd={() => setTimeout(() => setHold(false), 3000)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      {slides.map((s, n) => (
        // eslint-disable-next-line @next/next/no-img-element -- static registry / placeholder files; first slide is the LCP image
        <img key={s.src} src={s.src} alt={s.alt} draggable={false} loading={n === 0 ? "eager" : "lazy"} fetchPriority={n === 0 ? "high" : "auto"} decoding="async" aria-hidden={n !== i} className={`absolute inset-0 size-full select-none object-cover object-[center_30%] transition-opacity duration-500 ${n === i ? "opacity-100" : "opacity-0"}`} />
      ))}
      {cur?.label && (
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow ${cur.label === "Before" ? "bg-[#0a2540] text-white" : cur.label === "After" ? "bg-emerald-500 text-white" : "bg-white/95 text-[#0a2540]"}`}>{cur.label}</span>
      )}
      {many && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(i - 1)} className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0a2540] shadow hover:bg-white"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Next photo" onClick={() => go(i + 1)} className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0a2540] shadow hover:bg-white"><ChevronRight className="size-5" /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((s, n) => (
              <button key={s.src} type="button" aria-label={`Show photo ${n + 1}`} aria-current={n === i} onClick={() => go(n)} className={`h-2 rounded-full shadow transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
