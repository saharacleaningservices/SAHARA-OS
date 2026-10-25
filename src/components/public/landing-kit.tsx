import Link from "next/link";
import { socialProfileUrls } from "@/lib/social-links";
import { FooterSocial } from "@/components/public/footer-social";
import type { ReactNode } from "react";
import { Phone, MapPin, Check, X, MessageCircle, Mail, Globe } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { CompanyLogo } from "@/components/shared/company-logo";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { BookingWizard } from "@/components/public/booking-wizard";
import { ServiceCards } from "@/components/public/service-cards";
import { LandingHeroCarousel, type CarouselImage } from "@/components/public/landing-hero-carousel";
import type { HomeRow } from "@/components/public/price-selector";
import { CONTACT, EQUIPMENT, TERMS, WEBSITE_URL, inr, livePkgs, reviewCountLabel, type Pkg } from "@/lib/marketing-content";
import { buildBusinessJsonLd } from "@/lib/seo-schema";
import { PriceSelector } from "@/components/public/price-selector";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { SERVICE_AREA_NOTICE, activeCampaign, todayIST } from "@/lib/pricing-master";
import { festivalUrgency } from "@/lib/festival-urgency";
import { getLivePricing, getPublicPricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homeHighlights, homePleaseNote, homeScopeByArea, type HomeTier } from "@/lib/service-scope";
import { toWhatsAppLink } from "@/lib/utils";
import { paymentDetailsFrom } from "@/lib/booking-payment";
import { COMPANY } from "@/lib/constants";

// Building blocks for the public marketing landing pages (/offers, /booking
// and the four service pages). Server components; all SEO text is real HTML.

export const BASE_URL = "https://booking.saharacleaningservices.com";
const waLink = (text: string, number: string = CONTACT.whatsapp) => `${toWhatsAppLink(number)}?text=${encodeURIComponent(text)}`;

// Verified public profiles (checked 30 Sep 2026) — only these are linked.
// Clean (untagged) profile URLs for the business JSON-LD `sameAs` — UTM-tagged links are for visitors, not search engines.
export const SOCIAL = socialProfileUrls().map((href) => ({ href }));

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
  // Owner 2026-10-25: sharp 1672×941 office-cleaning photo (Royal Blue uniforms) — booking hero first slide + Commercial card.
  commercial: { src: "/marketing/hero-commercial-v2.webp", alt: "Sahara team in Royal Blue uniforms vacuuming carpet and wiping desks in a Pune office", position: "36% 30%" },
  painting: { src: "/marketing/service-painting.webp", alt: "Sahara painters rolling and taping a living-room wall in Pune" },
  pest: { src: "/marketing/service-pest-control.webp", alt: "Sahara pest control technician spraying along kitchen cabinet edges in Pune" },
  painting2: { src: "/marketing/hero-painting-2.webp", alt: "Two Sahara painters rolling and cutting in a bedroom wall with furniture covered" },
  painting3: { src: "/marketing/hero-painting-3.webp", alt: "Freshly painted living room in Pune with protective sheets being cleared away" },
  pest2: { src: "/marketing/hero-pest-2.webp", alt: "Sahara technician inspecting a wardrobe base and door frame for termites" },
  pest3: { src: "/marketing/hero-pest-3.webp", alt: "Sahara technician applying targeted treatment along a bathroom drain and skirting" },
};
/** All four services — for the festival / booking hero. Commercial leads (owner 2026-10-25); the residential slide stays second. */
export const ALL_SERVICES_SLIDES: CarouselImage[] = [CAROUSEL.commercial, CAROUSEL.team, CAROUSEL.painting, CAROUSEL.pest];
function heroImages(image: string, alt: string): CarouselImage[] {
  if (image === "/marketing/hero-home.webp") return [CAROUSEL.team, CAROUSEL.equipment];
  if (image === CAROUSEL.commercial.src) return [CAROUSEL.commercial, CAROUSEL.equipment];
  if (image === CAROUSEL.painting.src) return [{ src: image, alt }, CAROUSEL.painting2, CAROUSEL.painting3];
  if (image === CAROUSEL.pest.src) return [{ src: image, alt }, CAROUSEL.pest2, CAROUSEL.pest3];
  return [{ src: image, alt }];
}

/** Business JSON-LD for every public page — built in src/lib/seo-schema.ts (single source for NAP + services). */
export function businessJsonLd(extra: Record<string, unknown> = {}) {
  return buildBusinessJsonLd({ sameAs: SOCIAL.map((s) => s.href), extra });
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

/** footer / mobileBar: campaign landing pages pass their own (components/public/campaign-kit.tsx). */
export function LandingShell({ logoUrl, waText, jsonLd, children, footer, mobileBar, bookHref = "/booking?service=home#book" }: { logoUrl?: string | null; waText: string; jsonLd: object[]; children: ReactNode; footer?: ReactNode; mobileBar?: ReactNode; bookHref?: string }) {
  return (
    <div className="theme-navy min-h-screen bg-[#eef4fb] pb-16 text-[#0a2540] sm:pb-0">
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
                <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${CONTACT.whatsapp}`} className="rounded-lg p-1.5 text-success hover:bg-success/10"><MessageCircle className="size-3.5" /></a>
              </span>
            ))}
            <Link href={bookHref} className="relative rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-[0_0_0_0_rgba(37,99,235,0.45)] motion-safe:animate-[sahara-glow_2.6s_ease-in-out_infinite]">Book Now</Link>
          </div>
        </div>
      </header>
      {children}
      <style>{`@keyframes sahara-glow{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}50%{box-shadow:0 0 0 7px rgba(37,99,235,0)}}`}</style>
      {footer ?? (
      <footer className="mt-6 bg-[#0a2540] text-white/80">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 text-sm sm:py-8 md:grid-cols-3">
          {/* Block 1 — Location */}
          <section aria-labelledby="ft-location" className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 id="ft-location" className="text-base font-extrabold text-white">Visit us</h2>
            <address className="flex gap-1.5 not-italic text-white/85"><MapPin className="mt-0.5 size-4 shrink-0 text-amber-400" />{CONTACT.address}</address>
            <iframe
              title="Sahara Cleaning Services on Google Maps"
              src="https://www.google.com/maps?q=Opposite+South+Gate,+Magarpatta+City,+Hadapsar,+Pune+411028&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-44 w-full rounded-xl border-0 bg-white/10"
            />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-white">
              {CONTACT.call.map((n) => <a key={n} href={`tel:+91${n}`} className="hover:text-amber-300">+91 {n.slice(0, 5)} {n.slice(5)}</a>)}
            </p>
          </section>
          {/* Block 2 — Service directory, email, social */}
          <section aria-labelledby="ft-services" className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 id="ft-services" className="text-base font-extrabold text-white">Our services</h2>
            <ul className="space-y-1.5 text-[13px]">
              <li><Link href="/home-deep-cleaning-pune#price-selector" className="hover:text-white">Home Deep Cleaning — packages &amp; prices</Link></li>
              <li><Link href="/commercial-cleaning-pune" className="hover:text-white">Office &amp; Commercial Cleaning</Link></li>
              <li><Link href="/interior-painting-pune" className="hover:text-white">Interior Painting</Link></li>
              <li><Link href="/pest-control-pune" className="hover:text-white">Pest Control</Link></li>
              <li><Link href="/housekeeping-services" className="hover:text-white">Housekeeping &amp; AMC</Link></li>
              <li><Link href="/booking#book" className="font-semibold text-amber-400">Book Online</Link></li>
            </ul>
            <a href={`mailto:${CONTACT.email}`} className="flex min-h-11 items-center gap-1.5 break-all text-white/85 hover:text-white"><Mail className="size-3.5 shrink-0" />{CONTACT.email}</a>
            <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 break-all text-white/85 hover:text-white"><Globe className="size-3.5 shrink-0" />www.saharacleaningservices.com</a>
          </section>
          {/* Block 3 — Trust, legal */}
          <section aria-labelledby="ft-trust" className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 id="ft-trust" className="text-base font-extrabold text-white">Serving Pune Since 2012</h2>
            <ul className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {["In-house verified staff", "Transparent pricing", "Pay after service"].map((b) => (
                <li key={b} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-white"><Check className="size-3 text-emerald-300" aria-hidden />{b}</li>
              ))}
            </ul>
            <div className="space-y-1 rounded-xl bg-white/5 px-3 py-2 text-[13px]">
              <p>GSTIN: <span className="font-semibold text-white">{COMPANY.gstin}</span></p>
              <p className="flex flex-wrap items-center gap-x-2"><Link href="/privacy-policy" className="inline-flex min-h-11 items-center underline hover:text-white">Privacy Policy</Link><span aria-hidden>·</span><Link href="/terms" className="inline-flex min-h-11 items-center underline hover:text-white">Terms &amp; Conditions</Link></p>
            </div>
            <FooterSocial />
            <Link href="/gallery" className="block text-[13px] hover:text-white">Our work — gallery</Link>
          </section>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-3 text-center text-[11px] text-white/50">© Sahara Cleaning Services</p>
        </div>
      </footer>
      )}
      {/* Mobile bottom bar — one primary number only. */}
      {mobileBar ?? (
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
        <a href={`tel:+91${CONTACT.call[0]}`} className="flex items-center justify-center gap-1 py-3 text-primary"><Phone className="size-3.5" /> Call</a>
        <a href={waLink(waText)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-success py-3 text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
        <Link href="/booking?service=home#book" className="bg-primary py-3 text-white">Book Now</Link>
      </div>
      )}
    </div>
  );
}

/**
 * Mobile bottom bar for /booking: Call + WhatsApp only (no "Book Now" — the booking wizard is the page).
 * Uses the primary customer number (CONTACT.call[0] for calls; CONTACT.whatsapp = 7083347130 for WhatsApp).
 */
export function CallWhatsAppBar({ waText }: { waText: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
      <a href={`tel:+91${CONTACT.call[0]}`} className="flex items-center justify-center gap-1 py-3 text-primary"><Phone className="size-3.5" /> Call</a>
      <a href={waLink(waText, CONTACT.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-success py-3 text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
    </div>
  );
}

export const FESTIVAL_BADGE = "🪔 Diwali Special Discounts Live!";

// Hero: photo and text never overlap, so faces and the service activity stay
// fully visible. Mobile — full-width photo, then badge + headline + actions
// below it. Desktop — text column left, photo column right. `eyebrow`,
// `note` and `primaryLabel` stay accepted for call-site compatibility.
export async function Hero({ image, alt, title, subtitle, badge, waText, primaryHref = "/booking", images, bookHrefOverride }: {
  image: string; alt: string; eyebrow?: string; title: string; subtitle: string; badge?: string; note?: string; primaryLabel: string; waText: string; primaryHref?: string; images?: CarouselImage[];
  /** Same-page anchor for Book Now (package pages scroll to their own booking form). */
  bookHrefOverride?: string;
}) {
  // Book Now goes straight to the service selection with Home Cleaning open.
  const bookHref = bookHrefOverride ?? (primaryHref === "/booking" || primaryHref.startsWith("#") ? "/booking?service=home#book" : primaryHref);
  // Trust + price proof from CRM Settings and the live price list — never hard-coded claims.
  const [settings, pricing] = await Promise.all([getCompanySettings().catch(() => null), getLivePricing()]);
  // Regular "from" price only outside festival periods — during a festival, prices
  // are shown after the customer opens the packages.
  const todayYmd = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const festivalOn = pricing.festivals.some((f) => f.end >= todayYmd);
  const fromPrice = festivalOn
    ? null
    : pricing.items.filter((p) => p.group === "PREMIUM" && p.price != null).reduce<number | null>((m, p) => (m == null || p.price! < m ? p.price! : m), null);
  // Rating / review count are the owner-set values in CRM Settings.
  const reviews = reviewCountLabel(settings?.googleReviewCount) || null;
  return (
    <section className="bg-[#0a2540] text-white">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[1fr_1.1fr] md:items-center md:gap-8 md:px-4 md:py-10">
        <div className="relative aspect-[4/3] overflow-hidden md:order-2 md:aspect-square md:rounded-3xl lg:aspect-[5/4]">
          <LandingHeroCarousel images={images ?? heroImages(image, alt)} />
        </div>
        <div className="px-4 py-6 md:order-1 md:px-0 md:py-0">
          {(badge?.startsWith("Quotation") || festivalOn) && (
            <p className={`inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#0a2540] sm:text-xs ${badge?.startsWith("Quotation") ? "" : "motion-safe:animate-[sahara-badge-pulse_2.2s_ease-in-out_infinite]"}`}>
              {badge?.startsWith("Quotation") ? badge : FESTIVAL_BADGE}
              <style>{`@keyframes sahara-badge-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.05)}}`}</style>
            </p>
          )}
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">{subtitle.split(/(?<=\.)\s/)[0]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:text-xs">
              {(settings?.googleRating || reviews) && (
                <a
                  href={settings?.googleReviewUrl?.trim() || GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Read our Google reviews (opens in a new tab)"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[#0a2540] shadow-sm ring-1 ring-white/40 transition hover:bg-amber-50"
                >
                  <FaGoogle className="size-3 text-[#4285F4]" aria-hidden />
                  <span>{settings?.googleRating ? `⭐ ${settings.googleRating}/5` : ""}{settings?.googleRating && reviews ? " | " : ""}{reviews ? `${reviews} Google Reviews` : ""}</span>
                </a>
              )}
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/90">Residential &amp; Commercial Services</span>
              {fromPrice != null && <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[#0a2540]">Full home deep cleaning from {inr(fromPrice)}</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={bookHref} className="relative rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/50 [animation-duration:2.2s]" aria-hidden />
              Book Now
            </Link>
          </div>
          {/* Both customer numbers stacked; Call + WhatsApp buttons share one fixed size so every row lines up. */}
          <div className="mt-3 grid max-w-sm gap-2">
            {CONTACT.call.map((n) => (
              <div key={n} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl bg-white/10 p-1.5 pl-4">
                <span className="text-sm font-semibold tabular-nums">+91 {n.slice(0, 5)} {n.slice(5)}</span>
                <a href={`tel:+91${n}`} aria-label={`Call ${n}`} className="flex h-10 w-[88px] items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-primary"><Phone className="size-3.5" /> Call</a>
                <a href={waLink(waText)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${CONTACT.whatsapp}`} className="flex h-10 w-[88px] items-center justify-center gap-1.5 rounded-xl bg-success text-xs font-bold text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-semibold text-white/70">Since 2012</p>
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
        // 4 BHK and larger: no fixed price — site inspection and a written quotation first.
        if (p.price == null) {
          return (
            <div key={p.bhk} className={`rounded-2xl bg-white p-3.5 text-center shadow-sm ${accent ? "border-2 border-amber-300" : ""}`}>
              <p className="font-bold">{p.bhk}</p>
              <p className="mt-0.5 text-sm font-extrabold leading-tight text-primary">Price on inspection</p>
              <p className="mt-0.5 text-[11px] font-medium text-[#0a2540]/60">Site inspection required</p>
              <Link href="/booking?service=home#book" className="mt-2 block rounded-lg bg-primary/10 py-1.5 text-xs font-bold text-primary">Request inspection</Link>
            </div>
          );
        }
        const body = (
          <>
            <p className="font-bold">{p.bhk}</p>
            <p className="mt-0.5"><span className="text-xl font-extrabold text-primary sm:text-2xl">{inr(p.price)}</span></p>
            {p.mrp != null && p.mrp > p.price && <p className="text-xs text-[#0a2540]/50">MRP <span className="line-through">{inr(p.mrp)}</span> · Save {inr(p.mrp - p.price)}</p>}
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

export async function QuoteSection({ title, subtitle, campaignName, defaultService, preset, hidePicker }: { title: string; subtitle: string; campaignName: string; defaultService?: string; preset?: { bhk: string; pkg: HomeTier }; /** The four service cards above pick the service (same as /booking). */ hidePicker?: boolean }) {
  const [pricing, settings] = await Promise.all([getPublicPricing(), getCompanySettings().catch(() => null)]); // painting rates are never sent to the public booking widget
  return (
    <section id="quote" className="scroll-mt-20">
      <span id="book" aria-hidden className="block scroll-mt-20" />
      <h2 className="text-center text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mb-3 text-center text-sm text-[#0a2540]/70">{subtitle}</p>
      <BookingWizard campaignName={campaignName} defaultCategory={SERVICE_TO_CATEGORY[defaultService ?? ""]} preset={preset} hidePicker={hidePicker} pricing={pricing} paymentDetails={paymentDetailsFrom(settings)} />
    </section>
  );
}

export function AreasBadge() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 rounded-full bg-white px-3 py-2 text-center text-xs font-semibold shadow-sm">
      <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-primary" /> Serving Pune &amp; PCMC</span>
      <span className="font-normal text-[#0a2540]/60">· extra charge may apply outside standard areas</span>
    </p>
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

export function Faqs({ faqs, compact }: { faqs: { q: string; a: string }[]; compact?: boolean }) {
  return (
    <section className="mx-auto max-w-3xl">
      <h2 className={`text-center font-bold ${compact ? "text-base" : "text-lg"}`}>Frequently asked questions</h2>
      <div className={`${compact ? "mt-2" : "mt-3"} divide-y divide-[#0a2540]/10 rounded-2xl bg-white shadow-sm`}>
        {faqs.map((f) => (
          <details key={f.q} className={compact ? "px-3 py-2" : "px-4 py-3"}>
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

// Festival marketing section (Navratri · Dussehra · Diwali). Prices come from
// Super Admin → Pricing & Packages; renders nothing when no festival offer is
// upcoming. Urgency is factual only: festival weeks are the busiest and the
// booking calendar shows live team availability — no countdowns or fake stock.
export async function FestivalSection({ bookHref = "?price=festival#quote" }: { bookHref?: string }) {
  const { items, festivals } = await getLivePricing();
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const upcoming = festivals.filter((f) => f.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  if (!upcoming.length) return null;
  const current = upcoming.find((f) => f.start <= today) ?? upcoming[0];
  const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const rows = ["1 BHK", "2 BHK", "3 BHK", "4 BHK"]
    .map((bhk) => {
      const tier = (t: HomeTier) => {
        const it = items.find((p) => p.bhk === bhk && p.variant === t);
        return it ? { regular: it.price, festival: current.prices[it.contentId] ?? null } : null;
      };
      return { bhk, premium: tier("Premium"), platinum: tier("Platinum") };
    })
    .filter((r) => r.premium?.festival != null || r.platinum?.festival != null);
  if (!rows.length) return null;
  // While the campaign runs, regular prices are not promoted here (festival packages only).
  const campaignOn = !!activeCampaign(festivals, today);
  const cell = (v: { regular: number | null; festival: number | null } | null) =>
    !v ? (
      <span className="text-[#0a2540]/40">—</span>
    ) : (
      <>
        <span className="block text-lg font-extrabold text-amber-700 sm:text-xl">{inr(v.festival ?? v.regular ?? 0)}</span>
        {!campaignOn && v.festival != null && v.regular != null && <span className="block text-[11px] text-[#0a2540]/55">Regular {inr(v.regular)} · other dates</span>}
      </>
    );

  return (
    <section id="festival" className="scroll-mt-20 overflow-hidden rounded-3xl bg-[#0a2540] text-white shadow-lg">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marketing/festival-banner.webp" alt="Festively decorated, freshly cleaned living room with diyas and marigold garlands" className="absolute inset-0 size-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a2540]/95 via-[#0a2540]/80 to-[#0a2540]/30" />
        <div className="relative space-y-3 p-5 sm:p-8">
          <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-[#0a2540]">🪔 {upcoming.map((f) => f.name).join(" · ")}</p>
          <h2 className="text-2xl font-extrabold leading-tight sm:text-4xl">Festival Special Home Cleaning</h2>
          <p className="max-w-xl text-sm text-white/85 sm:text-base">
            Limited festival slots — book your preferred date. Festival weeks are our busiest of the year and teams fill up first on the days before each festival.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {upcoming.map((f) => (
              <span key={f.id} className={`rounded-full px-3 py-1 ${f.id === current.id ? "bg-white text-[#0a2540]" : "bg-white/15"}`}>
                {f.name}: {day(f.start)} – {day(f.end)}
                {f.id === current.id && f.start <= today ? " · now" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white p-4 text-[#0a2540] sm:p-6">
        <p className="text-sm font-bold">{current.name} prices — full home deep cleaning</p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-[#0a2540]/10">
          <div className="grid grid-cols-3 bg-[#0a2540]/[0.04] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#0a2540]/70">
            <span>Size</span>
            <span>Premium</span>
            <span>Platinum ⭐</span>
          </div>
          {rows.map((r) => (
            <div key={r.bhk} className="grid grid-cols-3 items-center border-t border-[#0a2540]/10 px-3 py-2.5">
              <span className="font-bold">{r.bhk}</span>
              <span>{cell(r.premium)}</span>
              <span>{cell(r.platinum)}</span>
            </div>
          ))}
          {campaignOn && (
            <div className="border-t border-[#0a2540]/10 px-3 py-2.5 text-sm">
              <span className="font-bold">4 BHK and larger</span> — <span className="font-semibold text-amber-700">Price on inspection · site inspection required</span>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#0a2540]/65">
          {campaignOn ? "Festival prices apply to service dates during the festival dates above." : "Festival prices apply to service dates during the festival dates above; regular prices apply on all other dates."} Package price applies to the selected scope — Platinum adds wall wet cleaning. Festival slots are subject to team availability; live availability is shown in the booking calendar.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={bookHref} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-amber-500 px-5 text-base font-extrabold text-[#0a2540] shadow-sm hover:bg-amber-400 sm:flex-none">
            Book Festival Cleaning
          </a>
          <a href={waLink(`Hi Sahara, I'd like to book ${current.name} festival home cleaning.`)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-success px-4 text-sm font-bold text-success">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

/** Rows for the PriceSelector from the live (festival-aware) Premium / Platinum packages. */
export function buildHomeRows(premium: Pkg[], platinum: Pkg[]): HomeRow[] {
  return ["1 BHK", "2 BHK", "3 BHK"].map((bhk) => {
    const pr = premium.find((p) => p.bhk === bhk)?.price ?? null;
    const pl = platinum.find((p) => p.bhk === bhk)?.price ?? null;
    return {
      bhk,
      premium: pr,
      platinum: pl,
      premiumHref: pr != null ? `/home-deep-cleaning-pune/${packageSlug(bhk, "Premium")}` : null,
      platinumHref: pl != null ? `/home-deep-cleaning-pune/${packageSlug(bhk, "Platinum")}` : null,
    };
  });
}

/** One-line price footnote under the PriceSelector (festival dates only while a campaign runs). */
export function festivalPriceNote(campaign: ReturnType<typeof activeCampaign>): string {
  if (!campaign) return "Regular package prices. Platinum adds wall wet cleaning.";
  const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return `${campaign.windows.map((w) => w.name).join(" · ")} prices for service dates ${day(campaign.start)} – ${day(campaign.end)}. Platinum adds wall wet cleaning. Slots subject to team availability.`;
}

/**
 * The compact "Select BHK → package → price" picker used identically on /booking and /offers.
 * Live prices (festival-aware); choosing Book hands the BHK + package to the booking form below.
 */
export async function CompactPriceSelector() {
  const pricing = await getLivePricing();
  const campaign = activeCampaign(pricing.festivals, todayIST());
  const rows = buildHomeRows(livePkgs(pricing.items, "PREMIUM", campaign?.current), livePkgs(pricing.items, "PLATINUM", campaign?.current));
  return <PriceSelector rows={rows} note={festivalPriceNote(campaign)} bookHref="#book" hideDetails heading={campaign ? "Festival prices — pick your home size" : "Pick your home size"} />;
}

/** The four service cards (same on /booking and /offers): tapping one opens that service in the booking form. */
/**
 * Top-of-page festival notice for the owner's demand window (src/lib/festival-urgency.ts). It disappears after the
 * window ends and never states a slot count or a price rise.
 */
export function FestivalUrgencyBar() {
  const u = festivalUrgency(todayIST());
  if (!u) return null;
  return (
    <div role="note" className="bg-[#b45309] px-4 py-2 text-center text-xs font-semibold leading-snug text-white sm:text-sm">
      ⚡ DIWALI SPECIAL: High demand for {u.label} dates! Book now to lock your preferred slot.
    </div>
  );
}

export async function FunnelCards() {
  const pricing = await getPublicPricing();
  const bathroom = pricing.items.find((i) => i.group === "CUSTOMISED" && /bathroom/i.test(i.name) && i.price != null);
  const urgency = festivalUrgency(todayIST());
  return (
    <ServiceCards
      badge={urgency ? `🔥 High demand ${urgency.label} — book early` : undefined}
      starts={{
        HOME: bathroom ? `Starting from ₹${bathroom.price!.toLocaleString("en-IN")}` : undefined,
        // No painting rate is published: painting is quoted after a free site inspection.
        PAINTING: "Free Site Inspection",
      }}
    />
  );
}
