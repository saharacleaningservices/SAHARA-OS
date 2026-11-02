"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Real before / after results (Claude Desktop handoff, owner 2026-11-03). Updated the same day: one compact carousel row instead of
 * three stacked grids, placed below Our Services / Combo packages.
 *   - Native scroll-snap track → touch swipe is handled by the browser (smooth, no JS on the gesture).
 *   - Left / right arrows + one pagination dot per card.
 *   - Autoplay every 4 s, only while the section is on screen; pauses on touch / hover / keyboard focus and for reduced motion.
 *   - Cards are a fixed 265 × 265 px (the source photos' own size) → no layout shift; photos lazy-load as they slide in.
 * Layout model: BOXED (inside the homepage's max-w-6xl column).
 */

type Category = "Kitchen & Bathroom" | "Sofa & Upholstery" | "Full House Deep Cleaning";
type Card = { src: string; alt: string; category: Category };

const BASE = "/images/before-after";
const AUTOPLAY_MS = 4000;
const SLIDE_MS = 450;

// Each WebP is a single 265x265 card that already shows the before and after side by side.
const CARDS: Card[] = [
  { src: "kb-toilet-limescale", alt: "Toilet limescale and stain removal, before and after", category: "Kitchen & Bathroom" },
  { src: "sofa-fabric-red", alt: "Fabric sofa shampooing and stain removal, before and after", category: "Sofa & Upholstery" },
  { src: "fh-terrace-tiles", alt: "Terrace tile cleaning, before and after", category: "Full House Deep Cleaning" },
  { src: "kb-bathroom-floor-wall", alt: "Bathroom floor and wall deep scrubbing, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-washbasin", alt: "Washbasin descaling, before and after", category: "Kitchen & Bathroom" },
  { src: "sofa-leather-cream", alt: "Cream sofa upholstery cleaning, before and after", category: "Sofa & Upholstery" },
  { src: "fh-balcony-wood-floor", alt: "Balcony and wooden floor restoration, before and after", category: "Full House Deep Cleaning" },
  { src: "kb-bathroom-tiles", alt: "Bathroom tile and grout cleaning, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-kitchen-sink-granite", alt: "Kitchen sink and granite platform cleaning, before and after", category: "Kitchen & Bathroom" },
  { src: "fh-flat-handover-floors", alt: "Flat floor restoration after handover, before and after", category: "Full House Deep Cleaning" },
  { src: "kb-toilet-seat-result", alt: "Toilet deep cleaning result, before and after", category: "Kitchen & Bathroom" },
  { src: "fh-balcony-rack", alt: "Balcony deep cleaning, before and after", category: "Full House Deep Cleaning" },
  { src: "kb-toilet-bowl", alt: "Toilet bowl stain removal, before and after", category: "Kitchen & Bathroom" },
  { src: "fh-balcony-railing", alt: "Balcony floor and railing cleaning, before and after", category: "Full House Deep Cleaning" },
  { src: "kb-bathroom-floor-tiles", alt: "Bathroom floor tile restoration, before and after", category: "Kitchen & Bathroom" },
  { src: "kb-bathroom-wc-floor", alt: "Bathroom floor grime removal, before and after", category: "Kitchen & Bathroom" },
];

const BADGE: Record<Category, string> = {
  "Kitchen & Bathroom": "bg-cyan-700",
  "Sofa & Upholstery": "bg-violet-600",
  "Full House Deep Cleaning": "bg-green-700",
};

/** Smoothly scroll the track to card n (fixed duration; scroll-snap paused during the animation). */
function scrollToCard(el: HTMLDivElement, n: number) {
  const card = el.children[n] as HTMLElement | undefined;
  if (!card) return;
  const to = Math.min(card.offsetLeft - el.offsetLeft, el.scrollWidth - el.clientWidth);
  const from = el.scrollLeft;
  if (from === to) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { el.scrollLeft = to; return; }
  const snap = el.style.scrollSnapType;
  el.style.scrollSnapType = "none";
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / SLIDE_MS);
    el.scrollLeft = from + (to - from) * (1 - (1 - k) ** 3);
    if (k < 1) requestAnimationFrame(step);
    else el.style.scrollSnapType = snap;
  };
  requestAnimationFrame(step);
}

export default function BeforeAfterSection() {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  const [visible, setVisible] = useState(false);

  // Which card is at the left edge (works for swipe, arrows, dots and autoplay alike).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
        const gap = 12;
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
        setActive(atEnd ? CARDS.length - 1 : Math.round(el.scrollLeft / (w + gap)));
      });
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => { el.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  // Autoplay only while the section is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = useCallback((n: number) => {
    const el = track.current;
    if (el) scrollToCard(el, (n + CARDS.length) % CARDS.length);
  }, []);

  useEffect(() => {
    if (hold || !visible) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const el = track.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      go(atEnd ? 0 : active + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [hold, visible, active, go]);

  const arrow = "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#0a2540] shadow-md ring-1 ring-[#0a2540]/10 hover:bg-white sm:size-11";

  return (
    <section
      ref={root}
      aria-labelledby="before-after-heading"
      aria-roledescription="carousel"
      className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      <h2 id="before-after-heading" className="text-center text-xl font-extrabold text-[#0a2540] sm:text-2xl">Real Results From Real Homes in Pune</h2>
      <p className="mt-1 text-center text-sm text-[#0a2540]/70">Actual before and after photos from Sahara Cleaning Services jobs.</p>

      <div className="relative mt-4">
        <button type="button" aria-label="Previous result" onClick={() => go(active - 1)} className={`${arrow} -left-2`}><ChevronLeft className="size-5" /></button>
        <div
          ref={track}
          onPointerDown={() => setHold(true)}
          onPointerUp={() => setTimeout(() => setHold(false), 4000)}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CARDS.map((card, n) => (
            <figure key={card.src} aria-roledescription="slide" aria-label={`${n + 1} of ${CARDS.length}`} className="relative m-0 h-[265px] w-[265px] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#eef4fb] shadow-sm">
              <Image src={`${BASE}/${card.src}.webp`} alt={card.alt} width={265} height={265} loading="lazy" sizes="265px" className="block h-[265px] w-[265px] object-cover" />
              <figcaption className={`absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold leading-tight text-white ${BADGE[card.category]}`}>{card.category}</figcaption>
            </figure>
          ))}
        </div>
        <button type="button" aria-label="Next result" onClick={() => go(active + 1)} className={`${arrow} -right-2`}><ChevronRight className="size-5" /></button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Choose a result">
        {CARDS.map((card, n) => (
          <button key={card.src} type="button" aria-label={`Show result ${n + 1}`} aria-current={n === active} onClick={() => go(n)} className="flex size-6 items-center justify-center">
            <span className={`block h-2 rounded-full transition-[width,background-color] duration-300 ${n === active ? "w-5 bg-primary" : "w-2 bg-[#0a2540]/25"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
