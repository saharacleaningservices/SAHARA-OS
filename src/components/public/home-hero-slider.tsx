"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Phone, ShieldCheck, Star } from "lucide-react";
import { openLead } from "@/components/public/bhk-price-cards";

export type HeroSlide = { src: string; alt: string; eyebrow: string; title: string; text: string; cta: string; service: string; inspection?: boolean; position?: string };

const ROTATE_MS = 5500;

/**
 * Homepage auto-sliding hero (rebuild 2026-11-02). Real Sahara work photos, headline overlay on a dark gradient so text
 * stays readable; fixed height per breakpoint → zero layout shift. First slide is `priority` (LCP), the rest lazy-load via
 * next/image (AVIF/WebP). Pauses on hover / focus and respects reduced-motion.
 */
export function HomeHeroSlider({ slides, callNumber, waHref, rating, reviews }: { slides: HeroSlide[]; callNumber: string; waHref: string; rating: string; reviews: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length);
  const s = slides[i];

  return (
    <section aria-roledescription="carousel" aria-label="Sahara services" className="relative h-[560px] w-full overflow-hidden bg-[#0a2540] sm:h-[600px] lg:h-[640px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {slides.map((sl, n) => (
        <div key={sl.src + n} aria-hidden={n !== i} className={`absolute inset-0 transition-opacity duration-1000 ${n === i ? "opacity-100" : "opacity-0"}`}>
          <Image src={sl.src} alt={sl.alt} fill priority={n === 0} loading={n === 0 ? undefined : "lazy"} sizes="100vw" quality={75} className="object-cover" style={{ objectPosition: sl.position ?? "50% 40%" }} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a2540] via-[#0a2540]/70 to-[#0a2540]/20 lg:bg-gradient-to-r lg:from-[#0a2540]/95 lg:via-[#0a2540]/65 lg:to-transparent" aria-hidden />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-14 text-white lg:justify-center lg:pb-0">
        <div className="max-w-xl" aria-live="polite">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#0a2540]">{s.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{s.title}</h1>
          <p className="mt-3 text-base text-white/85 sm:text-lg">{s.text}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => openLead({ service: s.service, inspection: s.inspection })} className="min-h-12 rounded-xl bg-amber-400 px-5 text-sm font-extrabold text-[#0a2540] shadow-lg hover:bg-amber-300">{s.cta}</button>
            <a href={`tel:+91${callNumber}`} className="sahara-wave-call inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-white/15 px-4 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"><Phone className="size-4" /> Call Now</a>
            <a href={waHref} target="_blank" rel="noreferrer" className="sahara-wave-wa inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</a>
          </div>
          <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-white/85">
            <span className="inline-flex items-center gap-1"><Star className="size-4 fill-amber-300 text-amber-300" />{rating}★ Google · {reviews} reviews</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-4 text-emerald-300" />In-house trained staff · GST invoice</span>
          </p>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30 lg:flex"><ChevronLeft className="size-6" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30 lg:flex"><ChevronRight className="size-6" /></button>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {slides.map((sl, n) => (
              <button key={sl.src + n} type="button" aria-label={`Show slide ${n + 1}: ${sl.eyebrow}`} aria-current={n === i} onClick={() => setI(n)} className={`h-2 rounded-full transition-all ${n === i ? "w-7 bg-amber-400" : "w-2 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
