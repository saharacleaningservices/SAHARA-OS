import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Top-of-page service picker for the festival landing: four rich visual cards (image + title +
// one line), each opening that service's page — Home Deep Cleaning scrolls to the price selector.

const CARDS = [
  { title: "Home Deep Cleaning", sub: "Premium & Platinum packages", href: "#price-selector", img: "/marketing/carousel-team.webp" },
  { title: "Commercial & Office Cleaning", sub: "Site visit & written quote", href: "/commercial-cleaning", img: "/marketing/hero-commercial.webp" },
  { title: "Pest Control Services", sub: "Inspection first", href: "/pest-control", img: "/marketing/hero-pest.webp" },
  { title: "Interior Painting", sub: "Free site inspection", href: "/painting-services", img: "/marketing/hero-painting.webp" },
];

export function ServiceGrid() {
  return (
    <nav aria-label="Our services" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {CARDS.map(({ title, sub, href, img }) => (
        <Link key={title} href={href} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#0a2540]/5 transition active:scale-[0.98]">
          <img src={img} alt={title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <span className="flex flex-1 flex-col gap-0.5 p-2.5">
            <span className="text-[13px] font-bold leading-tight sm:text-sm">{title}</span>
            <span className="text-[11px] text-[#0a2540]/60">{sub}</span>
            <span className="mt-1.5 flex min-h-9 items-center justify-center gap-0.5 rounded-lg bg-primary/10 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-white">
              Book Now <ChevronRight className="size-3.5" />
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
