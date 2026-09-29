import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Phone, MapPin, Check, X, MessageCircle } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { CampaignEnquiryForm } from "@/components/public/campaign-enquiry-form";
import { CONTACT, EAST_PUNE_AREAS, TERMS, inr, type Pkg } from "@/lib/marketing-content";
import { toWhatsAppLink } from "@/lib/utils";

// Building blocks for the public marketing landing pages (/offers and the
// service pages). Server components; all SEO text is real HTML.

export const BASE_URL = "https://booking.saharacleaningservices.com";
const waLink = (text: string) => `${toWhatsAppLink(CONTACT.whatsapp)}?text=${encodeURIComponent(text)}`;

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
    areaServed: EAST_PUNE_AREAS.map((a) => `${a}, Pune`),
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
            <a href={`tel:+91${CONTACT.call[0]}`} className="hidden items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-xs font-semibold text-primary sm:flex"><Phone className="size-4" /> {CONTACT.call[0]}</a>
            <a href="#quote" className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">Get Quote</a>
          </div>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-[#0a2540]/60">
        © Sahara Cleaning Services · Since 2012 · {CONTACT.address} · {CONTACT.email} ·{" "}
        <Link href="/privacy-policy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
        <a href={`tel:+91${CONTACT.call[0]}`} className="py-3 text-primary">Call</a>
        <a href={waLink(waText)} target="_blank" rel="noreferrer" className="bg-success py-3 text-white">WhatsApp</a>
        <a href="#quote" className="bg-primary py-3 text-white">Get Quote</a>
      </div>
    </div>
  );
}

export function Hero({ image, alt, eyebrow, title, subtitle, badge, note, primaryLabel, waText }: {
  image: string; alt: string; eyebrow?: string; title: string; subtitle: string; badge?: string; note?: string; primaryLabel: string; waText: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#0a2540] text-white">
      <Image src={image} alt={alt} fill priority sizes="100vw" className="object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a2540] via-[#0a2540]/85 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-20">
        {badge && <p className="inline-block animate-pulse rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#0a2540] [animation-duration:2.5s]">{badge}</p>}
        {eyebrow && <p className="mt-3 text-sm font-semibold uppercase tracking-wider text-white/85">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-bold italic leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg">{subtitle}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#quote" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">{primaryLabel}</a>
          <a href={`tel:+91${CONTACT.call[0]}`} className="rounded-full border border-white/70 px-5 py-3 text-sm font-bold">Call {CONTACT.call[0]}</a>
          <a href={`tel:+91${CONTACT.call[1]}`} className="rounded-full border border-white/70 px-5 py-3 text-sm font-bold">Call {CONTACT.call[1]}</a>
          <a href={waLink(waText)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-success px-5 py-3 text-sm font-bold"><MessageCircle className="size-4" />WhatsApp</a>
        </div>
        {note && <p className="mt-4 max-w-2xl text-xs text-white/75">{note}</p>}
        <p className="mt-4 text-xs font-semibold text-white/80">Since 2012 · 20+ Years Cleaning Industry Experience · East Pune</p>
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

export function QuoteSection({ title, subtitle, campaignName, defaultService }: { title: string; subtitle: string; campaignName: string; defaultService?: string }) {
  return (
    <section id="quote" className="scroll-mt-20">
      <h2 className="text-center text-2xl font-bold">{title}</h2>
      <p className="mb-4 text-center text-sm text-[#0a2540]/70">{subtitle}</p>
      <CampaignEnquiryForm campaignName={campaignName} defaultService={defaultService} />
    </section>
  );
}

export function HowItWorks() {
  const steps = ["Get a quote on call, WhatsApp or the form", "Confirm your preferred date & time", "Our trained team arrives with equipment", "Enjoy a cleaner, healthier space"];
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
    <section>
      <h2 className="text-xl font-bold">Areas we serve in East Pune</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {EAST_PUNE_AREAS.map((a) => <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm"><MapPin className="size-3 text-primary" />{a}</span>)}
      </div>
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
    <section>
      <h2 className="text-xl font-bold">Terms &amp; conditions</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0a2540]/80">{TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
    </section>
  );
}

export function FinalCta({ title, waText }: { title: string; waText: string }) {
  return (
    <section className="sahara-gradient rounded-3xl px-6 py-8 text-center text-white">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <a href="#quote" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary">Get Quote</a>
        <a href={`tel:+91${CONTACT.call[0]}`} className="rounded-full border border-white/70 px-5 py-3 text-sm font-bold">Call {CONTACT.call[0]}</a>
        <a href={`tel:+91${CONTACT.call[1]}`} className="rounded-full border border-white/70 px-5 py-3 text-sm font-bold">Call {CONTACT.call[1]}</a>
        <a href={waLink(waText)} target="_blank" rel="noreferrer" className="rounded-full bg-success px-5 py-3 text-sm font-bold">WhatsApp {CONTACT.whatsapp}</a>
      </div>
    </section>
  );
}
