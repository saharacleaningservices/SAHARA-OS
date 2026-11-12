import { Leaf, MessageCircle, Phone, Star, Timer } from "lucide-react";
import { waLink, CONTACT } from "@/lib/marketing-content";
import { ServiceSlider, type SliderSlide } from "@/components/public/service-slider";

/**
 * Standardised 2-column split hero for every service page (owner 2026-11-12). Left: clean background, category badge,
 * H1, one-line subtitle and the three CTAs (no bullet lines, no dark text overlay). Right: the unobstructed
 * Before / After / equipment slider. Phones stack text + CTAs first, the compact slider right below. Layout model: BOXED
 * (max-w-6xl) on desktop, fluid on mobile.
 */
export function ServiceSplitHero({ title, subtitle, badge, slides, waText, waNumber, cta, ctaHref }: {
  title: string;
  subtitle: string;
  badge?: string;
  slides: SliderSlide[];
  waText: string;
  waNumber?: string;
  cta: string;
  ctaHref: string;
}) {
  return (
    <section className="border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-blue-50/40 to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-5 px-4 py-5 sm:py-8 lg:grid-cols-2 lg:gap-10">
        <div>
          {badge && <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#0a2540]">{badge}</p>}
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[#0a2540] sm:text-4xl">{title}</h1>
          <p className="mt-2 line-clamp-2 max-w-xl text-sm text-[#0a2540]/75 sm:text-base">{subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
            <a href={ctaHref} className="sahara-shimmer inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-white">{cta}</a>
            <a href={`tel:+91${CONTACT.call[0]}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-primary px-4 py-2.5 text-sm font-bold text-primary"><Phone className="size-4" /> Call Now</a>
            <a href={waLink(waText, waNumber)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-success px-4 py-2.5 text-sm font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</a>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#0a2540] sm:text-[13px]" aria-label="Why Sahara">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200"><Star className="size-3.5 fill-amber-400 text-amber-400" />4.9★ Rated in Pune</li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200"><Timer className="size-3.5 text-primary" />60-Min Dispatch</li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200"><Leaf className="size-3.5 text-emerald-600" />Eco-Safe Chemicals</li>
          </ul>
        </div>
        <div className="overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl">
          <ServiceSlider slides={slides} />
        </div>
      </div>
    </section>
  );
}
