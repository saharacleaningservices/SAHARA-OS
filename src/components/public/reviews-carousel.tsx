"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { FaGoogle } from "react-icons/fa6";

export type Review = { name: string; text: string; rating?: number };

const ROTATE_MS = 5000;

// No placeholder/fallback review: with no real featured reviews configured,
// nothing is shown (never present an invented testimonial as genuine).

export function ReviewsCarousel({ reviews, reviewUrl }: { reviews: Review[]; reviewUrl?: string }) {
  const list = reviews;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || list.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, list.length]);

  const current = list[index] ?? list[0];
  if (!current) return null;
  const stars = Math.max(1, Math.min(5, Math.round(current.rating ?? 5)));

  return (
    <section
      id="reviews"
      className="rounded-xl border border-border bg-white p-4 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-1.5 flex items-center gap-1 text-yellow-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`size-4 ${i < stars ? "fill-current" : "fill-none text-yellow-200"}`} />
        ))}
      </div>
      <p className="min-h-[3.6em] text-sm text-foreground">&ldquo;{current.text}&rdquo;</p>
      <p className="mt-2 text-sm font-semibold text-foreground">— {current.name}</p>
      <p className="text-xs text-muted-foreground">Verified Google Review</p>

      {list.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show review ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-primary/25"
              }`}
            />
          ))}
        </div>
      )}

      {reviewUrl && (
        <a href={reviewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
          <FaGoogle className="size-3.5" /> Read all Google Reviews
        </a>
      )}
    </section>
  );
}
