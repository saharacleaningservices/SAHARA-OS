"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type CarouselImage = { src: string; alt: string };

/**
 * Background image carousel for the landing / booking heroes. CSS scroll-snap
 * gives native swipe on mobile; a 4.5s timer advances it and pauses while
 * the user is touching/hovering or the tab is hidden. Only the first image is
 * loaded eagerly (LCP); the rest load lazily.
 */
export function LandingHeroCarousel({ images }: { images: CarouselImage[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const el = track.current;
    if (!el || images.length < 2) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setInterval(() => {
      if (paused.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % images.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearInterval(timer);
    };
  }, [images.length]);

  const hold = () => (paused.current = true);
  const release = () => (paused.current = false);

  return (
    <div className="absolute inset-0">
      <div
        ref={track}
        onPointerEnter={hold}
        onPointerLeave={release}
        onTouchStart={hold}
        onTouchEnd={release}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={img.src} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={img.src}
              alt={img.alt}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : "lazy"}
              sizes="100vw"
              className="object-cover opacity-45"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
