"use client";

import { useState } from "react";

export type CarouselLogo = { name: string; src: string };

/**
 * Infinite auto-scroll client-logo marquee (owner 2026-11-01). One list, rendered twice for a seamless CSS loop (the copy is aria-hidden)
 * so there is never a duplicated static grid. Zero broken images: a logo that fails to load is dropped from both rows instead of
 * showing a broken-image icon, and the strip hides itself when nothing is left. No spinner, no JS animation — a GPU-friendly CSS
 * transform; paused on hover / focus and switched off for reduced-motion visitors (they get a horizontally scrollable row).
 * Layout model: BOXED — `max-w-6xl` card on desktop, full-width swipe on mobile.
 */
export function ClientCarousel({ logos, title = "Trusted by businesses across Pune" }: { logos: CarouselLogo[]; title?: string }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const ok = logos.filter((l, i, a) => !failed.has(l.src) && a.findIndex((x) => x.src === l.src) === i);
  if (ok.length === 0) return null;
  // Short lists are repeated so the loop always covers a wide screen.
  const base = ok.length < 6 ? Array.from({ length: Math.ceil(6 / ok.length) }, () => ok).flat() : ok;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {base.map((l, i) => (
        <li key={`${hidden}-${i}-${l.src}`} className="flex h-14 w-32 shrink-0 items-center justify-center">
          <img src={l.src} alt={hidden ? "" : l.name} width={128} height={48} loading="lazy" decoding="async" onError={() => setFailed((s) => new Set(s).add(l.src))} className="max-h-12 max-w-full object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby="client-carousel-title" className="mx-auto w-full max-w-6xl rounded-3xl bg-white p-5 shadow-sm">
      <h2 id="client-carousel-title" className="text-center text-sm font-bold uppercase tracking-wide text-[#0a2540]/70">{title}</h2>
      <div className="group mt-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-[sahara-client-marquee_36s_linear_infinite] [transform:translateZ(0)] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none">
          {row(false)}
          {row(true)}
        </div>
      </div>
      <style>{`@keyframes sahara-client-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}
