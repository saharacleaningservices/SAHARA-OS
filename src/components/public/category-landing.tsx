import Link from "next/link";
import type { ReactNode } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { waLink, CONTACT } from "@/lib/marketing-content";

// Shared blocks for the category ad-landing pages (/residential-cleaning, /commercial-cleaning,
// /painting-services, /pest-control, /housekeeping-services). Server components, no client JS
// except the form (category-lead-form.tsx). Rendered inside LandingShell, which already loads
// AttributionCapture (UTM / gclid / fbclid → localStorage) and the Meta Pixel + GA tags.


export function CategoryHero({ title, subtitle, image, alt, points, waText, badge, cta = "Get Free Quote", ctaHref = "#enquiry" }: {
  title: string;
  subtitle: string;
  image: string;
  alt: string;
  points: string[];
  waText: string;
  badge?: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[#0a2540] text-white">
      <img src={image} alt={alt} className="absolute inset-0 -z-10 size-full object-cover opacity-30" fetchPriority="high" />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {badge && <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold text-[#0a2540]">{badge}</p>}
        <h1 className="mt-2 text-[26px] font-extrabold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-white/85 sm:text-base">{subtitle}</p>
        <ul className="mt-3 grid gap-1.5 text-sm text-white/90 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />{p}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href={ctaHref} className="sahara-shimmer min-h-11 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-[#0a2540]">{cta}</a>
          <a href={`tel:+91${CONTACT.call[0]}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-primary"><Phone className="size-4" /> {CONTACT.call[0]}</a>
          <a href={waLink(waText)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-success px-4 py-2.5 text-sm font-bold"><MessageCircle className="size-4" /> WhatsApp</a>
        </div>
      </div>
    </section>
  );
}

export type Tile = { title: string; text: string; note?: string; href?: string; cta?: string };

/** Service cards. `note` carries a live price line when the pricing master has one. */
export function ServiceTiles({ heading, sub, tiles }: { heading: string; sub?: string; tiles: Tile[] }) {
  return (
    <section>
      <h2 className="text-xl font-bold sm:text-2xl">{heading}</h2>
      {sub && <p className="text-sm text-[#0a2540]/70">{sub}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.title} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-bold">{t.title}</h3>
            <p className="mt-1 flex-1 text-sm text-[#0a2540]/75">{t.text}</p>
            {t.note && <p className="mt-2 text-sm font-semibold text-amber-700">{t.note}</p>}
            {t.href && <Link href={t.href} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary px-3 text-sm font-bold text-primary">{t.cta ?? "Book now"}</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-sm text-[#0a2540]/80">{children}</div>
    </section>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{i}</li>
      ))}
    </ul>
  );
}

/** Desktop floating WhatsApp button (mobile uses CategoryBar below). */
export function StickyWhatsApp({ waText }: { waText: string }) {
  return (
    <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-50 hidden min-h-12 items-center gap-2 rounded-full bg-success px-5 text-sm font-bold text-white shadow-lg sm:inline-flex">
      <MessageCircle className="size-5" /> WhatsApp us
    </a>
  );
}

/** Mobile sticky bar: Call · WhatsApp · primary CTA (scrolls to the enquiry form). */
export function CategoryBar({ waText, cta, href = "#enquiry" }: { waText: string; cta: string; href?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
      <a href={`tel:+91${CONTACT.call[0]}`} className="flex items-center justify-center gap-1 py-3 text-primary"><Phone className="size-3.5" /> Call</a>
      <a href={waLink(waText)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-success py-3 text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
      <a href={href} className="flex items-center justify-center bg-primary py-3 text-white">{cta}</a>
    </div>
  );
}
