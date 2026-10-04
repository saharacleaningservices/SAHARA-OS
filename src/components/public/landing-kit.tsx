import Link from "next/link";
import type { ReactNode } from "react";
import { Phone, MapPin, Check, X, MessageCircle, Mail } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { CompanyLogo } from "@/components/shared/company-logo";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { BookingWizard } from "@/components/public/booking-wizard";
import { LandingHeroCarousel, type CarouselImage } from "@/components/public/landing-hero-carousel";
import { CONTACT, EQUIPMENT, TERMS, inr, type Pkg } from "@/lib/marketing-content";
import { SERVICE_AREA_NOTICE } from "@/lib/pricing-master";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homeHighlights, homePleaseNote, homeScopeByArea, type HomeTier } from "@/lib/service-scope";
import { toWhatsAppLink } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";

// Building blocks for the public marketing landing pages (/offers, /booking
// and the four service pages). Server components; all SEO text is real HTML.

export const BASE_URL = "https://booking.saharacleaningservices.com";
const waLink = (text: string, number: string = CONTACT.whatsapp) => `${toWhatsAppLink(number)}?text=${encodeURIComponent(text)}`;

// Verified public profiles (checked 30 Sep 2026) — only these are linked.
const SOCIAL = [
  { href: "https://www.facebook.com/saharacleaningservices", label: "Facebook", icon: FaFacebookF },
  { href: "https://www.instagram.com/saharacleaningservices.pune/", label: "Instagram", icon: FaInstagram },
];

// Service pages, for internal linking between the campaign landings.
export const SERVICE_LINKS = [
  { href: "/home-deep-cleaning-pune", label: "Home Deep Cleaning Pune" },
  { href: "/commercial-cleaning-pune", label: "Office & Commercial Cleaning Pune" },
  { href: "/interior-painting-pune", label: "Interior Painting Pune" },
  { href: "/pest-control-pune", label: "Pest Control Pune" },
];

// Hero slides — real Sahara service visuals, one per service.
export const CAROUSEL = {
  team: { src: "/marketing/carousel-team.webp", alt: "Sahara cleaning team deep cleaning a living room in Pune" },
  equipment: { src: "/marketing/carousel-equipment.webp", alt: "Sahara technician using an upholstery extraction machine on a sofa" },
  result: { src: "/marketing/carousel-result.webp", alt: "Freshly deep-cleaned living room by Sahara Cleaning Services" },
  commercial: { src: "/marketing/hero-commercial.webp", alt: "Sahara team scrubbing floors and cleaning glass partitions in a Pune office" },
  painting: { src: "/marketing/hero-painting.webp", alt: "Sahara painter rolling fresh paint on a living-room wall in Pune" },
  pest: { src: "/marketing/hero-pest.webp", alt: "Sahara pest control technician treating kitchen cabinet edges in Pune" },
};
/** All four services — for the festival / booking hero. */
export const ALL_SERVICES_SLIDES: CarouselImage[] = [CAROUSEL.team, CAROUSEL.commercial, CAROUSEL.painting, CAROUSEL.pest];
function heroImages(image: string, alt: string): CarouselImage[] {
  if (image === "/marketing/hero-home.webp") return [CAROUSEL.team, CAROUSEL.equipment];
  if (image === CAROUSEL.commercial.src) return [CAROUSEL.commercial, CAROUSEL.equipment];
  return [{ src: image, alt }];
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
    sameAs: SOCIAL.map((s) => s.href),
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
          <Link href="/offers" aria-label="Sahara Cleaning Services — festival offers"><CompanyLogo logoUrl={logoUrl} className="h-[40px] w-auto max-w-[160px]" /></Link>
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
      <footer className="mx-auto max-w-6xl px-4 pb-6 pt-2 sm:pb-8">
        <div className="border-t-2 border-primary/25 pt-4 text-center text-xs text-[#0a2540]/70">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-semibold">
            <a href={`tel:+91${CONTACT.call[0]}`} className="inline-flex items-center gap-1.5 text-primary"><Phone className="size-3.5" />{CONTACT.call[0]}</a>
            <a href={`mailto:${CONTACT.email}`} className="inline-flex items-center gap-1.5 text-primary"><Mail className="size-3.5" />{CONTACT.email}</a>
          </div>
          <address className="mt-2 not-italic">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0 text-primary" />{CONTACT.address}</span>
            <span className="mt-0.5 block text-[11px] text-[#0a2540]/55">GSTIN: {COMPANY.gstin}</span>
          </address>
          <nav aria-label="Services" className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
            {SERVICE_LINKS.map((s) => <Link key={s.href} href={s.href} className="hover:text-primary">{s.label.replace(" Pune", "")}</Link>)}
            <Link href="/booking" className="font-semibold text-primary">Book Online</Link>
          </nav>
          <div className="mt-3 flex items-center justify-center gap-2">
            {SOCIAL.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" aria-label={label} className="flex size-9 items-center justify-center rounded-full bg-white text-primary shadow-sm hover:bg-primary hover:text-white">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#0a2540]/55">
            © Sahara Cleaning Services · Since 2012 · Pune &amp; PCMC ·{" "}
            <Link href="/privacy-policy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
          </p>
        </div>
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

// Hero: photo and text never overlap, so faces and the service activity stay
// fully visible. Mobile — full-width photo, then badge + headline + actions
// below it. Desktop — text column left, photo column right. `eyebrow`,
// `note` and `primaryLabel` stay accepted for call-site compatibility.
export function Hero({ image, alt, title, subtitle, badge, waText, primaryHref = "/booking", images, bookHrefOverride }: {
  image: string; alt: string; eyebrow?: string; title: string; subtitle: string; badge?: string; note?: string; primaryLabel: string; waText: string; primaryHref?: string; images?: CarouselImage[];
  /** Same-page anchor for Book Now (package pages scroll to their own booking form). */
  bookHrefOverride?: string;
}) {
  const bookHref = bookHrefOverride ?? primaryHref === "#book" ? "/booking#book" : primaryHref.startsWith("#") ? "/booking" : primaryHref;
  return (
    <section className="bg-[#0a2540] text-white">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[1fr_1.1fr] md:items-center md:gap-8 md:px-4 md:py-10">
        <div className="relative aspect-[4/3] overflow-hidden md:order-2 md:aspect-square md:rounded-3xl lg:aspect-[5/4]">
          <LandingHeroCarousel images={images ?? heroImages(image, alt)} />
        </div>
        <div className="px-4 py-6 md:order-1 md:px-0 md:py-0">
          <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#0a2540] sm:text-xs">
            {badge?.startsWith("Quotation") ? badge : FESTIVAL_BADGE}
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">{subtitle.split(/(?<=\.)\s/)[0]}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={bookHref} className="relative rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/50 [animation-duration:2.2s]" aria-hidden />
              Book Now
            </Link>
            {CONTACT.call.map((n) => (
              <a key={n} href={`tel:+91${n}`} aria-label={`Call ${n}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25">
                <Phone className="size-3.5" /> {n}
              </a>
            ))}
            <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-2 text-xs font-semibold">
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          </div>
          <p className="mt-4 text-[11px] font-semibold text-white/70">Since 2012 · Trained, supervised teams · Pune &amp; PCMC</p>
        </div>
      </div>
    </section>
  );
}

export const packageSlug = (bhk: string, tier: HomeTier) => `${bhk.replace(/\s+/g, "-").toLowerCase()}-${tier.toLowerCase()}`;

export function PackageGrid({ items, accent, tier }: { items: Pkg[]; accent?: boolean; tier?: HomeTier }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {items.map((p) => {
        const body = (
          <>
            <p className="font-bold">{p.bhk}</p>
            <p className="mt-0.5"><span className="text-xl font-extrabold text-primary sm:text-2xl">{inr(p.price)}</span></p>
            <p className="text-xs text-[#0a2540]/50">MRP <span className="line-through">{inr(p.mrp)}</span></p>
            {tier && <p className="mt-2 rounded-lg bg-primary/10 py-1.5 text-xs font-bold text-primary">View scope &amp; book</p>}
          </>
        );
        const cls = `rounded-2xl bg-white p-3.5 text-center shadow-sm ${accent ? "border-2 border-amber-300" : ""}`;
        return tier ? (
          <Link key={p.bhk} href={`/home-deep-cleaning-pune/${packageSlug(p.bhk, tier)}`} className={`${cls} block active:scale-[0.99]`}>{body}</Link>
        ) : (
          <div key={p.bhk} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}

/** Room-wise Scope of Work + Please note + customer requirements for a full-house tier. */
export function RoomScope({ tier, compact }: { tier: HomeTier; compact?: boolean }) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      {!compact && (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {homeHighlights(tier).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{h}</li>)}
        </ul>
      )}
      <div>
        <h3 className="font-bold">Scope of work — room by room</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {homeScopeByArea(tier).map((a) => (
            <div key={a.area} className="rounded-xl bg-[#0a2540]/[0.03] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{a.area}</p>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {a.items.map((i) => <li key={i.item} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-success" /><span><span className="font-semibold">{i.item}:</span> {i.method}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#0a2540]/65"><span className="font-semibold">Equipment we bring:</span> {EQUIPMENT.join(" · ")} · {HOME_DURATION}</p>
      </div>
      <div>
        <h3 className="font-bold">Please note · not included · extra</h3>
        <ul className="mt-1.5 space-y-1 text-[13px] text-[#0a2540]/80">{homePleaseNote(tier).map((s) => <li key={s} className="flex gap-1.5"><X className="mt-0.5 size-3.5 shrink-0 text-red-500" />{s}</li>)}</ul>
      </div>
      <div>
        <h3 className="font-bold">Please arrange</h3>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-[#0a2540]/80">{CUSTOMER_REQUIREMENTS.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
    </div>
  );
}

/** Scope card — what's included, what isn't, and the equipment the team brings. */
export function ScopeLists({ included, excluded, equipment = EQUIPMENT }: { included: string[]; excluded?: string[]; equipment?: string[] | null }) {
  return (
    <div className="mt-4 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
      <div>
        <h3 className="font-semibold">What&apos;s included</h3>
        <ul className="mt-2 space-y-1.5 text-sm">{included.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{s}</li>)}</ul>
      </div>
      <div className="space-y-4">
        {excluded && (
          <div>
            <h3 className="font-semibold">Not included</h3>
            <ul className="mt-2 space-y-1.5 text-sm">{excluded.map((s) => <li key={s} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{s}</li>)}</ul>
          </div>
        )}
        {equipment && equipment.length > 0 && (
          <div>
            <h3 className="font-semibold">Equipment we bring</h3>
            <p className="mt-1 text-sm text-[#0a2540]/75">{equipment.join(" · ")} — handled by a trained, supervisor-led team.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Landing-page booking section: the same CRM-powered booking flow as /booking
// (package → available date → slot → payment preference → Confirm Booking
// Request), preselected for the page's service.
const SERVICE_TO_CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { HOME_DEEP_CLEANING: "HOME", COMMERCIAL_CLEANING: "COMMERCIAL", PEST_CONTROL: "PEST", PAINTING: "PAINTING" };

export function QuoteSection({ title, subtitle, campaignName, defaultService, preset }: { title: string; subtitle: string; campaignName: string; defaultService?: string; preset?: { bhk: string; pkg: HomeTier } }) {
  return (
    <section id="quote" className="scroll-mt-20">
      <h2 className="text-center text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mb-3 text-center text-sm text-[#0a2540]/70">{subtitle}</p>
      <BookingWizard campaignName={campaignName} defaultCategory={SERVICE_TO_CATEGORY[defaultService ?? ""]} preset={preset} />
    </section>
  );
}

export function HowItWorks() {
  const steps = ["Choose service & see price", "Pick an available date & time", "We confirm on WhatsApp", "Trained team arrives equipped"];
  return (
    <section>
      <h2 className="text-lg font-bold">How it works</h2>
      <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => <li key={s} className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm"><span className="font-extrabold text-primary">{i + 1}.</span> {s}</li>)}
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

/** "Other services" internal links for the service landing pages. */
export function OtherServices({ current }: { current: string }) {
  return (
    <section>
      <h2 className="text-lg font-bold">Other Sahara services in Pune</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {SERVICE_LINKS.filter((s) => s.href !== current).map((s) => (
          <Link key={s.href} href={s.href} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-white">{s.label}</Link>
        ))}
      </div>
    </section>
  );
}

export function Faqs({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="text-center text-lg font-bold">Frequently asked questions</h2>
      <div className="mt-3 divide-y divide-[#0a2540]/10 rounded-2xl bg-white shadow-sm">
        {faqs.map((f) => (
          <details key={f.q} className="px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{f.q}</summary>
            <p className="mt-1.5 text-sm text-[#0a2540]/70">{f.a}</p>
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
