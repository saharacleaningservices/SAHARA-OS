import Image from "next/image";
import { FooterSocial } from "@/components/public/footer-social";
import { bookingLink } from "@/lib/social-links";
import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { QuickLeadForm } from "@/components/public/quick-lead-form";
import { MapOnTap } from "@/components/public/map-on-tap";
import { CONTACT, GOOGLE_MAPS_URL, LOCALITIES, WEBSITE_URL, inr } from "@/lib/marketing-content";
import { COMPANY } from "@/lib/constants";
import { getCompanySettings } from "@/server/settings";
import { toWhatsAppLink } from "@/lib/utils";

// Ad-campaign landing pages (Google / Meta traffic): conversion hero with an
// instant 3-field form, animated CTAs, mobile sticky price bar and a
// 5-column footer. Used only on the four service landing pages — /booking
// keeps the standard LandingShell hero and footer.

const waLink = (text: string, number: string = CONTACT.whatsapp) => `${toWhatsAppLink(number)}?text=${encodeURIComponent(text)}`;
const MAP_QUERY = "Sahara Cleaning Services, Opposite South Gate, Magarpatta City, Hadapsar, Pune 411028";

/** CTA micro-animations (reduced-motion users get static buttons). */
export function CampaignStyles() {
  return (
    <style>{`
@keyframes sahara-shimmer{0%{background-position:-180% 0}100%{background-position:180% 0}}
@keyframes sahara-nudge{0%,88%,100%{transform:translateY(0) rotate(0)}90%{transform:translateY(-3px) rotate(-6deg)}92%{transform:translateY(0) rotate(6deg)}94%{transform:translateY(-2px) rotate(-4deg)}96%{transform:translateY(0) rotate(0)}}
@keyframes sahara-ripple{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.1);opacity:0}}
@media (prefers-reduced-motion:no-preference){
.sahara-shimmer{background-image:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);background-size:200% 100%;animation:sahara-shimmer 2.6s linear infinite}
.sahara-nudge{animation:sahara-nudge 5s ease-in-out infinite}
.sahara-ripple::before{content:"";position:absolute;inset:0;border-radius:9999px;background:#25d366;animation:sahara-ripple 1.8s ease-out infinite;z-index:-1}
}`}</style>
  );
}

export async function CampaignHero({ title, subtitle, service, serviceLabel, campaignName, waText, packageLabel, image, alt }: {
  title: string;
  subtitle: string;
  service: string;
  serviceLabel: string;
  campaignName: string;
  waText: string;
  packageLabel?: string;
  image: string;
  alt: string;
}) {
  const settings = await getCompanySettings().catch(() => null);
  const reviews = settings?.googleReviewCount ? settings.googleReviewCount.replace(/\d+/, (d) => Number(d).toLocaleString("en-IN")) : null;
  const trust = [settings?.googleRating ? `★ ${settings.googleRating} Rated` : null, reviews ? `${reviews} Reviews` : null, "Pune & PCMC"].filter(Boolean);
  const call = CONTACT.call[0];
  // Owner 2026-10-25: the category card photo IS the hero (Home card → Home hero, Commercial card → Commercial hero).
  const position = image.includes("hero-commercial") ? "36% 30%" : "50% 50%";
  return (
    // Split-screen hero (owner 2026-10-25). Layout model: BOX MODEL — photo left, never covered by the form; floating quote card
    // right. Phones: full-width photo first, then the card.
    <section className="bg-[#0a2540] text-white">
      <div className="mx-auto grid max-w-6xl md:grid-cols-2 md:items-center md:gap-8 md:px-4 md:py-10">
        <div className="relative aspect-[4/3] overflow-hidden md:rounded-3xl md:shadow-2xl lg:aspect-[5/4]">
          {/* next/image: phones get a resized AVIF/WebP; priority = preloaded as the LCP element. */}
          <Image src={image} alt={alt} fill priority sizes="(min-width: 768px) 50vw, 100vw" quality={70} className="object-cover" style={{ objectPosition: position }} />
        </div>
        <div className="px-4 py-6 md:rounded-3xl md:bg-white/[0.07] md:p-6 md:shadow-2xl md:ring-1 md:ring-white/15 md:backdrop-blur" id="hero-quote">
          <p className="text-[11px] font-bold tracking-wide text-amber-300 sm:text-xs">{trust.join("  |  ")}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-white/85 sm:text-base">{subtitle}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold sm:text-xs">
            <ShieldCheck className="size-4 shrink-0 text-emerald-300" /> 100% In-House Staff in Branded Sahara Uniforms &amp; Verified ID Badges
          </p>
          <div className="mt-4">
            <QuickLeadForm service={service} serviceLabel={serviceLabel} campaignName={campaignName} packageLabel={packageLabel} waNumber={CONTACT.whatsapp} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href="#quote" className="sahara-shimmer rounded-full bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-[#0a2540]">Book Online</a>
            <a href={`tel:+91${call}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-primary">
              <Phone className="sahara-nudge size-4" /> Call Now: {call}
            </a>
            <a href={waLink(waText)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2.5 text-sm font-bold">
              <span className="sahara-ripple relative isolate flex size-5 items-center justify-center rounded-full"><MessageCircle className="size-4" /></span>
              Get WhatsApp Quote
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Collapsed-by-default block (scope / FAQs) to keep the booking form near the top on phones. */
export function Accordion({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-bold text-primary">
        {title}
        <span className="transition-transform group-open:rotate-180" aria-hidden>▼</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Mobile sticky bar: package + price (struck MRP only when the owner set a genuine one) + Lock Slot. */
export function CampaignBar({ label, price, mrp, priceNote, cta = "Lock Slot (Pay After) →" }: { label: string; price?: number | null; mrp?: number | null; priceNote?: string; cta?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-2 border-t border-border bg-white px-3 py-2 sm:hidden">
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[11px] font-semibold text-[#0a2540]/70">{label}</p>
        <p className="text-sm font-extrabold text-primary">
          {price != null ? (
            <>
              {mrp != null && mrp > price && <span className="mr-1.5 text-xs font-semibold text-[#0a2540]/45 line-through">{inr(mrp)}</span>}
              {inr(price)}
            </>
          ) : (
            <span className="text-xs">{priceNote}</span>
          )}
        </p>
      </div>
      <a href="#quote" className="sahara-shimmer shrink-0 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-white">{cta}</a>
    </div>
  );
}

// Owner 2026-10-26: every service heading is a booking intent → /booking with the service pre-selected; the service
// landing page stays linked underneath ("Prices & details") for internal SEO linking.
const FOOTER_COLUMNS: { title: string; href: string; info?: string; items: string[] }[] = [
  { title: "Home Cleaning", href: "/booking?service=home#book", info: "/home-deep-cleaning-pune", items: ["Full Home Deep Cleaning", "Post-Interior Cleaning", "Move-In / Move-Out", "Sofa & Carpet", "Kitchen & Bathroom"] },
  { title: "Painting Services", href: "/booking?service=painting#book", info: "/interior-painting-pune", items: ["Interior Painting", "Exterior Painting", "Waterproofing", "Rental Repaint", "Texture Painting"] },
  { title: "Pest Control", href: "/booking?service=pest#book", info: "/pest-control-pune", items: ["Cockroach Control", "Bed Bugs", "Termite Drill-Fill", "Rodent Control", "AMC Plans"] },
  { title: "Commercial Cleaning", href: "/booking?service=commercial#book", info: "/commercial-cleaning-pune", items: ["Office Deep Cleaning", "Glass Partition Cleaning", "Floor Scrubbing", "Restaurant / Shop Cleaning"] },
  { title: "Facility Management", href: "/housekeeping-services", items: ["Corporate Housekeeping", "Society Housekeeping", "Security Guard Services", "Manpower Augmentation"] },
];

export function CampaignFooter({ logoUrl, waText }: { logoUrl?: string | null; waText: string }) {
  return (
    <footer className="mt-6 border-t-2 border-primary bg-white text-sm text-[#0a2540]/80">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <nav aria-label="Services" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {FOOTER_COLUMNS.map((c) => (
            <div key={c.title}>
              <Link href={c.href} className="text-xs font-bold uppercase tracking-wide text-[#0a2540] hover:text-primary">{c.title} →</Link>
              <ul className="mt-1.5 space-y-0.5 text-[13px]">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
              {c.info && <Link href={c.info} className="mt-1 inline-flex min-h-8 items-center text-[12px] font-semibold text-primary hover:underline">Prices &amp; details</Link>}
            </div>
          ))}
        </nav>
        <div className="mt-6 grid gap-5 border-t border-primary/20 pt-5 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2">
            <CompanyLogo logoUrl={logoUrl} className="h-12 w-auto max-w-[220px]" />
            <p className="font-bold text-[#0a2540]">Sahara Cleaning Services</p>
            {CONTACT.call.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <span className="font-semibold text-[#0a2540]">{n}</span>
                <a href={`tel:+91${n}`} aria-label={`Call ${n}`} className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Phone className="size-3.5" /></a>
                <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${CONTACT.whatsapp}`} className="flex size-8 items-center justify-center rounded-full bg-success/10 text-success"><MessageCircle className="size-3.5" /></a>
              </div>
            ))}
            <p className="flex gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />{CONTACT.address}</p>
            <p className="text-xs">GSTIN: {COMPANY.gstin}</p>
            <a href={`mailto:${CONTACT.email}`} className="flex min-h-11 items-center gap-1.5 break-all text-xs font-medium text-[#0a2540] hover:text-primary">{CONTACT.email}</a>
            <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 break-all text-xs font-medium text-[#0a2540] hover:text-primary">www.saharacleaningservices.com</a>
            <a href={bookingLink("footer", "social", "book_online")} className="flex min-h-11 items-center gap-1.5 text-xs font-bold text-primary hover:underline">Book online — pick a date &amp; slot →</a>
            <FooterSocial className="flex gap-2 pt-1" iconClass="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white" />
          </div>
          <MapOnTap
            title="Sahara Cleaning Services on Google Maps"
            embedSrc={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`}
            mapsUrl={GOOGLE_MAPS_URL}
            address={CONTACT.address}
          />
        </div>
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0a2540]">Areas we serve</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {LOCALITIES.filter((l) => l !== "Other").map((l) => <li key={l} className="rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-[#0a2540]/75">{l}</li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-primary/30">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-[11px] text-[#0a2540]/60 sm:justify-between">
          <span>© Sahara Cleaning Services · Serving Pune Since 2012 · GSTIN: {COMPANY.gstin} · {CONTACT.call.join(" / ")}</span>
          <span className="flex flex-wrap items-center gap-x-2"><Link href="/privacy-policy" className="inline-flex min-h-11 items-center underline">Privacy Policy</Link><span aria-hidden>·</span><Link href="/terms" className="inline-flex min-h-11 items-center underline">Terms &amp; Conditions</Link></span>
        </p>
      </div>
    </footer>
  );
}
