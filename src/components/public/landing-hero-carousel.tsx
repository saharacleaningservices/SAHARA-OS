"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/** position: optional CSS object-position (focal point) so wide photos keep their people in the 4:3 / square hero frame. */
export type CarouselImage = { src: string; alt: string; position?: string };

/**
 * Background image carousel for the landing / booking heroes. CSS scroll-snap
 * gives native swipe on mobile; a 3.2s timer advances it and pauses while
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
    }, 3200);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearInterval(timer);
    };
  }, [images.length]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const next = (Math.round(el.scrollLeft / el.clientWidth) + dir + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
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
              // object-cover in a 4:3 / square frame needs the image WIDER than the frame (a 16:9 photo ≈ 1.35–1.8× the
              // frame width), otherwise the optimizer serves a too-narrow file that is stretched up and looks blurry.
              sizes="(min-width: 1024px) 1100px, (min-width: 768px) 90vw, 140vw"
              className="object-cover object-[50%_30%]"
              style={img.position ? { objectPosition: img.position } : undefined}
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous image" onClick={() => go(-1)} className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-2xl text-white backdrop-blur hover:bg-white/40 md:flex">‹</button>
          <button type="button" aria-label="Next image" onClick={() => go(1)} className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-2xl text-white backdrop-blur hover:bg-white/40 md:flex">›</button>
        </>
      )}
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
