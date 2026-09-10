"use client";

import { useEffect, useState } from "react";
import { HomeCleaningArt, InteriorPaintingArt, PestControlArt } from "./service-illustrations";

const SLIDES = [
  { Art: HomeCleaningArt, label: "Home Deep Cleaning" },
  { Art: InteriorPaintingArt, label: "Interior Painting" },
  { Art: PestControlArt, label: "Pest Control" },
] as const;

const ROTATE_MS = 3800;

/**
 * Simple auto-rotating 3-slide hero carousel — no external carousel library
 * exists in this codebase (checked src/components/ui and src/components/public),
 * so this is a small self-contained CSS/JS one built from the existing inline
 * service-illustration art instead of fabricated photography.
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
      {SLIDES.map(({ Art, label }, i) => (
        <div
          key={label}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Art className="h-full w-full" />
          <span className="absolute bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow sm:text-sm">
            {label}
          </span>
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
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
