"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type HeroPhoto = { src: string; alt: string; position?: string };

const ROTATE_MS = 4500;

/**
 * Text-free homepage photo slider (owner 2026-11-02). Native CSS scroll-snap track: touch swipe is handled by the browser's
 * compositor, so it never lags or flickers; autoplay just scrolls the track one slide and pauses while the visitor touches it.
 * Fixed aspect ratio per breakpoint → zero layout shift. First photo is `priority` (LCP); the rest lazy-load as AVIF/WebP.
 */
export function HomeHeroSlider({ photos }: { photos: HeroPhoto[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  // Track the visible slide from the scroll position (works for swipe, autoplay and dot taps alike).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))); };
    el.addEventListener("scroll", on, { passive: true });
    return () => { el.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (hold || photos.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % photos.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: next === 0 ? "auto" : "smooth" });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [hold, photos.length]);

  const go = (n: number) => track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: "smooth" });

  return (
    <section aria-roledescription="carousel" aria-label="Sahara at work" className="relative w-full bg-[#0a2540]">
      <div
        ref={track}
        onPointerDown={() => setHold(true)}
        onPointerUp={() => setTimeout(() => setHold(false), 3000)}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:aspect-[16/7] lg:aspect-[21/8] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, n) => (
          <div key={p.src} className="relative h-full w-full shrink-0 snap-center snap-always" aria-roledescription="slide" aria-label={`${n + 1} of ${photos.length}`}>
            <Image src={p.src} alt={p.alt} fill priority={n === 0} loading={n === 0 ? undefined : "lazy"} sizes="100vw" quality={80} draggable={false} className="select-none object-cover" style={{ objectPosition: p.position ?? "50% 45%" }} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {photos.map((p, n) => (
            <button key={p.src} type="button" aria-label={`Show photo ${n + 1}`} aria-current={n === i} onClick={() => go(n)} className={`h-2 rounded-full shadow transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
