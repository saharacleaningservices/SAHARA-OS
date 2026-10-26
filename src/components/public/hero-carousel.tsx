"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/brand/hero/home-cleaning.jpg", label: "Home Cleaning" },
  { src: "/brand/hero/office-cleaning.jpg", label: "Commercial Cleaning" },
  { src: "/brand/hero/interior-painting.jpg", label: "Interior Painting" },
  { src: "/brand/hero/pest-control.jpg", label: "Pest Control" },
] as const;

const ROTATE_MS = 4000;

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
