import Link from "next/link";
import { Building2, Bug, Home, PaintRoller } from "lucide-react";

// Top-of-page service picker for the festival landing: four visual cards, each
// opening that service's landing page (home → the price selector on this page).

const CARDS = [
  { title: "Home Deep Cleaning", sub: "Premium & Platinum", href: "#price-selector", icon: Home, tone: "bg-sky-100 text-sky-700" },
  { title: "Commercial & Office Cleaning", sub: "Site visit & quote", href: "/commercial-cleaning", icon: Building2, tone: "bg-indigo-100 text-indigo-700" },
  { title: "Pest Control Services", sub: "Inspection first", href: "/pest-control", icon: Bug, tone: "bg-emerald-100 text-emerald-700" },
  { title: "Interior Painting", sub: "Free site inspection", href: "/painting-services", icon: PaintRoller, tone: "bg-amber-100 text-amber-700" },
];

export function ServiceGrid() {
  return (
    <nav aria-label="Our services" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CARDS.map(({ title, sub, href, icon: Icon, tone }) => (
        <Link key={title} href={href} className="flex min-h-[88px] flex-col items-start justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#0a2540]/5 transition active:scale-[0.98]">
          <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden /></span>
          <span>
            <span className="block text-[13px] font-bold leading-tight">{title}</span>
            <span className="block text-[11px] text-[#0a2540]/60">{sub}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
