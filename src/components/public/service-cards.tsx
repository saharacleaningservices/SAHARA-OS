"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Landing service cards — image, one-line benefit and "View Packages". Clicking
 * opens that service inside the booking form below (no reload); prices are shown
 * there, not on the cards.
 */
const SERVICES = [
  { key: "HOME", title: "Home Cleaning", benefit: "Full Home Deep Cleaning, Sofa, Mattress & More", img: "/marketing/carousel-team.webp" },
  { key: "COMMERCIAL", title: "Office & Commercial", benefit: "Offices, shops, clinics & contracts — written quote", img: "/marketing/hero-commercial.webp" },
  { key: "PAINTING", title: "Interior Painting", benefit: "Residential & full home painting, Asian Paints", img: "/marketing/hero-painting.webp" },
  { key: "PEST", title: "Pest Control", benefit: "Home, office & commercial — price after inspection", img: "/marketing/hero-pest.webp" },
] as const;

/** starts: optional honest "starting from" line per service (from the live price list). */
export function ServiceCards({ starts = {} }: { starts?: Partial<Record<"HOME" | "COMMERCIAL" | "PAINTING" | "PEST", string>> }) {
  const [active, setActive] = useState<string>("");
  function open(key: string) {
    setActive(key);
    window.dispatchEvent(new CustomEvent("sahara:select-service", { detail: key }));
    document.getElementById("bk-service")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <section aria-label="Our services">
      <h2 className="text-lg font-bold sm:text-xl">Choose a service</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {SERVICES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => open(s.key)}
            aria-pressed={active === s.key}
            className={`group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition active:scale-[0.98] ${active === s.key ? "ring-2 ring-primary" : ""}`}
          >
            <img src={s.img} alt={s.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <span className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
              <span className="text-sm font-bold leading-tight sm:text-base">{s.title}</span>
              <span className="text-[11px] leading-snug text-[#0a2540]/65 sm:text-xs">{s.benefit}</span>
              {starts[s.key] && <span className="text-[11px] font-semibold leading-snug text-primary">{starts[s.key]}</span>}
              <span className="mt-auto flex min-h-9 items-center justify-center gap-0.5 rounded-lg bg-primary/10 pt-0 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-white">
                Book Now <ChevronRight className="size-3.5" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
