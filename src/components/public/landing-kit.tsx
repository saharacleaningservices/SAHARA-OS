import Link from "next/link";
import type { ReactNode } from "react";
import { Phone, MapPin, Check, X, MessageCircle } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { BookingWizard } from "@/components/public/booking-wizard";
import { LandingHeroCarousel, type CarouselImage } from "@/components/public/landing-hero-carousel";
import { CONTACT, TERMS, inr, type Pkg } from "@/lib/marketing-content";
import { SERVICE_AREA_NOTICE } from "@/lib/pricing-master";
import { toWhatsAppLink } from "@/lib/utils";

// Building blocks for the public marketing landing pages (/offers and the
// service pages). Server components; all SEO text is real HTML.

export const BASE_URL = "https://booking.saharacleaningservices.com";
const waLink = (text: string, number: string = CONTACT.whatsapp) => `${toWhatsAppLink(number)}?text=${encodeURIComponent(text)}`;

// Shared hero carousel: the page's own image first, then equipment and result.
export const CAROUSEL = {
  team: { src: "/marketing/carousel-team.webp", alt: "Sahara cleaning team deep cleaning a living room in Pune" },
  equipment: { src: "/marketing/carousel-equipment.webp", alt: "Sahara technician using an upholstery extraction machine on a sofa" },
  result: { src: "/marketing/carousel-result.webp", alt: "Freshly deep-cleaned living room by Sahara Cleaning Services" },
};
function heroImages(image: string, alt: string): CarouselImage[] {
  const first = image === "/marketing/hero-home.webp" ? CAROUSEL.team : { src: image, alt };
  return [first, CAROUSEL.equipment, CAROUSEL.result];
}

export function businessJsonLd(extra: Record<string, unknown> = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: "Sahara Cleaning Services",
    url: "https://www.saharacleaningservices.com",
    telephone: CONTACT.call.map((n) => `+91${n}`),
    email: CONTACT.email,
    foundingDate: "2012",
    address: { "@type": "PostalAddress", streetAddress: "Opposite South Gate, Magarpatta City, Hadapsar", addressLocality: "Pune", postalCode: "411028", addressRegion: "Maharashtra", addressCountry: "IN" },
    areaServed: ["Pune", "Pimpri-Chinchwad (PCMC)"],
    ...extra,
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function LandingShell({ logoUrl, waText, jsonLd, children }: { logoUrl?: string | null; waText: string; jsonLd: object[]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef4fb] pb-16 text-[#0a2540] sm:pb-0">
      <AttributionCapture />
      <MarketingTags withPixel />
      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/offers" aria-label="Sahara Cleaning Services — festival offers"><CompanyLogo logoUrl={logoUrl} className="h-[40px] w-auto max-w-[160px]" showTm /></Link>
          <div className="flex items-center gap-2">
            {CONTACT.call.map((n) => (
              <span key={n} className="hidden items-center gap-1 rounded-xl border border-primary/40 py-1 pl-3 pr-1 text-xs font-semibold text-primary md:flex">
                {n}
                <a href={`tel:+91${n}`} aria-label={`Call ${n}`} className="rounded-lg p-1.5 hover:bg-primary/10"><Phone className="size-3.5" /></a>
                <a href={waLink(waText, n)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${n}`} className="rounded-lg p-1.5 text-success hover:bg-success/10"><MessageCircle className="size-3.5" /></a>
              </span>
            ))}
            <Link href="/booking" className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">Book Now</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-[#0a2540]/60">
        © Sahara Cleaning Services · Since 2012 · {CONTACT.address} ·{" "}
        <a href={`tel:+91${CONTACT.call[0]}`} className="font-semibold text-primary">{CONTACT.call[0]}</a> · {CONTACT.email} ·{" "}
        <Link href="/privacy-policy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
      </footer>
      {/* Mobile bottom bar — one primary number only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
        <a href={`tel:+91${CONTACT.call[0]}`} className="flex items-center justify-center gap-1 py-3 text-primary"><Phone className="size-3.5" /> Call</a>
        <a href={waLink(waText)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-success py-3 text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
        <Link href="/booking" className="bg-primary py-3 text-white">Book Now</Link>
      </div>
    </div>
  );
}

export const FESTIVAL_BADGE = "🎉 NAVRATRI • DUSSEHRA • DIWALI — FESTIVAL CLEANING";

// Compact hero: short headline over clearly visible team photos. `subtitle`,
// `eyebrow` and `note` are kept for call-site compatibility but only the
// headline + one short line are shown so the photos stay visible.
export function Hero({ image, alt, title, subtitle, badge, waText, primaryHref = "/booking", images }: {
  image: string; alt: string; eyebrow?: string; title: string; subtitle: string; badge?: string; note?: string; primaryLabel: string; waText: string; primaryHref?: string; images?: CarouselImage[];
}) {
  const bookHref = primaryHref.startsWith("#") && primaryHref !== "#book" ? "/booking" : primaryHref === "#book" ? "/booking#book" : primaryHref;
  return (
    <section className="relative flex min-h-[360px] items-end overflow-hidden bg-[#0a2540] text-white sm:min-h-[440px]">
      <LandingHeroCarousel images={images ?? heroImages(image, alt)} />
      {/* Light bottom scrim only — photos stay visible. Text layer passes swipes through; links stay clickable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a2540]/90 via-[#0a2540]/25 to-transparent md:bg-gradient-to-r md:from-[#0a2540]/80 md:via-[#0a2540]/20" />
      <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-24 md:pb-14 [&_a]:pointer-events-auto">
        <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#0a2540] shadow sm:text-xs">{badge?.startsWith("Quotation") ? badge : FESTIVAL_BADGE}</p>
        <h1 className="mt-3 max-w-xl text-2xl font-bold leading-tight drop-shadow sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-white/90 drop-shadow sm:text-base">{subtitle.split(/(?<=\.)\s/)[0]}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={bookHref} className="relative rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/60 [animation-duration:2.2s]" aria-hidden />
            Book Now
          </Link>
          {CONTACT.call.map((n) => (
            <a key={n} href={`tel:+91${n}`} aria-label={`Call ${n}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/25">
              <Phone className="size-3.5" /> {n}
            </a>
          ))}
          <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="inline-flex size-9 items-center justify-center rounded-full bg-success">
            <MessageCircle className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function PackageGrid({ items, accent }: { items: Pkg[]; accent?: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((p) => (
        <div key={p.bhk} className={`rounded-2xl bg-white p-4 text-center shadow-sm ${accent ? "border-2 border-amber-300" : ""}`}>
          <p className="font-bold">{p.bhk}</p>
          <p className="mt-1"><span className="text-2xl font-extrabold text-primary">{inr(p.price)}</span></p>
          <p className="text-xs text-[#0a2540]/50">MRP <span className="line-through">{inr(p.mrp)}</span></p>
        </div>
      ))}
    </div>
  );
}

export function ScopeLists({ included, excluded }: { included: string[]; excluded?: string[] }) {
  return (
    <div className="mt-4 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
      <div>
        <h3 className="font-semibold">What&apos;s included</h3>
        <ul className="mt-2 space-y-1.5 text-sm">{included.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{s}</li>)}</ul>
      </div>
      {excluded && (
        <div>
          <h3 className="font-semibold">Not included</h3>
          <ul className="mt-2 space-y-1.5 text-sm">{excluded.map((s) => <li key={s} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Landing-page booking section: the same CRM-powered booking flow as /booking
// (package → available date → slot → payment preference → Confirm Booking
// Request), preselected for the page's service.
const SERVICE_TO_CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { HOME_DEEP_CLEANING: "HOME", COMMERCIAL_CLEANING: "COMMERCIAL", PEST_CONTROL: "PEST", PAINTING: "PAINTING" };

export function QuoteSection({ title, subtitle, campaignName, defaultService }: { title: string; subtitle: string; campaignName: string; defaultService?: string }) {
  return (
    <section id="quote" className="scroll-mt-20">
      <h2 className="text-center text-2xl font-bold">{title}</h2>
      <p className="mb-4 text-center text-sm text-[#0a2540]/70">{subtitle}</p>
      <BookingWizard campaignName={campaignName} defaultCategory={SERVICE_TO_CATEGORY[defaultService ?? ""]} />
    </section>
  );
}

export function HowItWorks() {
  const steps = ["Choose your service and see the price", "Pick an available date & time", "We confirm your booking on WhatsApp", "Our trained team arrives with equipment"];
  return (
    <section>
      <h2 className="text-xl font-bold">How it works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-4">
        {steps.map((s, i) => <li key={s} className="rounded-2xl bg-white p-4 text-sm shadow-sm"><span className="font-extrabold text-primary">{i + 1}.</span> {s}</li>)}
      </ol>
    </section>
  );
}

export function Areas() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-bold"><MapPin className="size-5 text-primary" /> Serving Pune &amp; PCMC</h2>
      <p className="mt-1 text-sm text-[#0a2540]/75">Professional cleaning services across Pune and Pimpri-Chinchwad. {SERVICE_AREA_NOTICE}</p>
    </section>
  );
}

export function Faqs({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="text-center text-xl font-bold">Frequently asked questions</h2>
      <div className="mt-4 space-y-2">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-2xl bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold">{f.q}</summary>
            <p className="mt-2 text-sm text-[#0a2540]/70">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Terms() {
  return (
    <details className="rounded-2xl bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-bold">Terms &amp; conditions</summary>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-[#0a2540]/75">{TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
    </details>
  );
}

export function FinalCta({ title, waText }: { title: string; waText: string }) {
  return (
    <section className="sahara-gradient rounded-3xl px-6 py-8 text-center text-white">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <a href="#quote" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary">Book Now</a>
        <a href={`tel:+91${CONTACT.call[0]}`} className="rounded-full border border-white/70 px-5 py-3 text-sm font-bold">Call {CONTACT.call[0]}</a>
        <a href={waLink(waText)} target="_blank" rel="noreferrer" className="rounded-full bg-success px-5 py-3 text-sm font-bold">WhatsApp</a>
      </div>
    </section>
  );
}
