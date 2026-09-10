"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/shared/company-logo";

// Five real, committed brand photos under /public/brand/hero — one per
// customer-facing service line. Order matches the sidebar "Our Services"
// cards on the booking page.
const SLIDES = [
  { src: "/brand/hero/home-cleaning.jpg", label: "Home Cleaning" },
  { src: "/brand/hero/office-cleaning.jpg", label: "Office Cleaning" },
  { src: "/brand/hero/interior-painting.jpg", label: "Interior Painting" },
  { src: "/brand/hero/pest-control.jpg", label: "Pest Control" },
  { src: "/brand/hero/housekeeping.jpg", label: "Housekeeping" },
] as const;

const ROTATE_MS = 4000;

/**
 * Auto-rotating 5-slide hero carousel built from real brand photography
 * (see /public/brand/hero). Slides cross-fade via a CSS opacity transition
 * instead of a hard cut or slide animation. The Sahara logo is rendered
 * once, fixed in the top-left corner of the carousel, layered above every
 * slide so it persists across the whole rotation.
 */
export function HeroCarousel({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-xl ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Logo — rendered once here (not per-slide) so it stays fixed
          top-left and above every slide across the whole rotation. */}
      <div className="absolute left-3 top-3 z-20 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-md backdrop-blur-sm">
        <CompanyLogo className="h-6 w-auto sm:h-7" />
      </div>

      {SLIDES.map(({ src, label }, i) => (
        <div
          key={label}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? "z-10 opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={src}
            alt={label}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            priority={i === 0}
          />
          <span className="absolute bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow sm:text-sm">
            {label}
          </span>
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-1.5">
        {SLIDES.map(({ label }, i) => (
          <button
            key={label}
            type="button"
            aria-label={`Show ${label} slide`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-primary" : "w-1.5 bg-primary/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
