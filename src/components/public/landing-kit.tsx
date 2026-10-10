import Link from "next/link";
import type { ReactNode } from "react";
import { Phone, MapPin, Check, X, MessageCircle, Mail } from "lucide-react";
import { FaFacebookF, FaGoogle, FaInstagram, FaYoutube } from "react-icons/fa";
import { CompanyLogo } from "@/components/shared/company-logo";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { BookingWizard } from "@/components/public/booking-wizard";
import { LandingHeroCarousel, type CarouselImage } from "@/components/public/landing-hero-carousel";
import { CONTACT, EQUIPMENT, TERMS, inr, type Pkg } from "@/lib/marketing-content";
import { SERVICE_AREA_NOTICE, activeCampaign } from "@/lib/pricing-master";
import { getLivePricing, getPublicPricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homeHighlights, homePleaseNote, homeScopeByArea, type HomeTier } from "@/lib/service-scope";
import { toWhatsAppLink } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";

// Building blocks for the public marketing landing pages (/offers, /booking
// and the four service pages). Server components; all SEO text is real HTML.

export const BASE_URL = "https://booking.saharacleaningservices.com";
const waLink = (text: string, number: string = CONTACT.whatsapp) => `${toWhatsAppLink(number)}?text=${encodeURIComponent(text)}`;

// Verified public profiles (checked 30 Sep 2026) — only these are linked.
export const SOCIAL = [
  { href: "https://www.facebook.com/saharacleaningservices", label: "Facebook", icon: FaFacebookF },
  { href: "https://www.instagram.com/saharacleaningservices.pune/", label: "Instagram", icon: FaInstagram },
  { href: "https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA", label: "YouTube", icon: FaYoutube },
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
  painting2: { src: "/marketing/hero-painting-2.webp", alt: "Two Sahara painters rolling and cutting in a bedroom wall with furniture covered" },
  painting3: { src: "/marketing/hero-painting-3.webp", alt: "Freshly painted living room in Pune with protective sheets being cleared away" },
  pest2: { src: "/marketing/hero-pest-2.webp", alt: "Sahara technician inspecting a wardrobe base and door frame for termites" },
  pest3: { src: "/marketing/hero-pest-3.webp", alt: "Sahara technician applying targeted treatment along a bathroom drain and skirting" },
};
/** All four services — for the festival / booking hero. */
export const ALL_SERVICES_SLIDES: CarouselImage[] = [CAROUSEL.team, CAROUSEL.commercial, CAROUSEL.painting, CAROUSEL.pest];
function heroImages(image: string, alt: string): CarouselImage[] {
  if (image === "/marketing/hero-home.webp") return [CAROUSEL.team, CAROUSEL.equipment];
  if (image === CAROUSEL.commercial.src) return [CAROUSEL.commercial, CAROUSEL.equipment];
  if (image === CAROUSEL.painting.src) return [{ src: image, alt }, CAROUSEL.painting2, CAROUSEL.painting3];
  if (image === CAROUSEL.pest.src) return [{ src: image, alt }, CAROUSEL.pest2, CAROUSEL.pest3];
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

/** footer / mobileBar: campaign landing pages pass their own (components/public/campaign-kit.tsx). */
export function LandingShell({ logoUrl, waText, jsonLd, children, footer, mobileBar, bookHref = "/booking?service=home#book" }: { logoUrl?: string | null; waText: string; jsonLd: object[]; children: ReactNode; footer?: ReactNode; mobileBar?: ReactNode; bookHref?: string }) {
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
            <Link href={bookHref} className="relative rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-[0_0_0_0_rgba(37,99,235,0.45)] motion-safe:animate-[sahara-glow_2.6s_ease-in-out_infinite]">Book Now</Link>
          </div>
        </div>
      </header>
      {children}
      <style>{`@keyframes sahara-glow{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}50%{box-shadow:0 0 0 7px rgba(37,99,235,0)}}`}</style>
      {footer ?? (
      <footer className="mt-6 bg-[#0a2540] text-white/80">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 text-sm sm:py-8">
          <p className="text-base font-extrabold text-white">Sahara Cleaning Services — Pune &amp; PCMC</p>
          {/* Call + WhatsApp quick-action chips for both customer numbers */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONTACT.call.map((n) => (
              <div key={n} className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
                <span className="flex-1 pl-1 font-bold tracking-wide text-white">{n}</span>
                <a href={`tel:+91${n}`} aria-label={`Call ${n}`} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#0a2540]"><Phone className="size-3.5" /> Call</a>
                <a href={waLink(waText, n)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${n}`} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-success px-3 text-xs font-bold text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
              </div>
            ))}
          </div>
          {/* Location */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <address className="flex min-w-0 gap-1.5 not-italic text-white/85"><MapPin className="mt-0.5 size-4 shrink-0 text-amber-400" />{CONTACT.address}</address>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Sahara+Cleaning+Services+Magarpatta+City+Hadapsar+Pune"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-bold text-[#0a2540]"
            >
              <MapPin className="size-3.5" /> Open in Google Maps
            </a>
          </div>
          {/* Categories + social / contact — clean 2-column grid */}
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <nav aria-label="Services">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Services</p>
              <ul className="mt-1.5 space-y-1">
                <li><Link href="/home-deep-cleaning-pune" className="hover:text-white">Home Deep Cleaning</Link></li>
                <li><Link href="/commercial-cleaning-pune" className="hover:text-white">Office &amp; Commercial</Link></li>
                <li><Link href="/interior-painting-pune" className="hover:text-white">Interior Painting</Link></li>
                <li><Link href="/pest-control-pune" className="hover:text-white">Pest Control</Link></li>
                <li><Link href="/booking" className="font-semibold text-amber-400">Book Online</Link></li>
              </ul>
            </nav>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Follow us</p>
              <div className="flex items-center gap-2">
                {SOCIAL.map(({ href, label, icon: Icon }) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer" aria-label={label} className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white hover:text-[#0a2540]">
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
              <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-1.5 break-all text-white/80 hover:text-white"><Mail className="size-3.5 shrink-0" />{CONTACT.email}</a>
              <Link href="/gallery" className="block hover:text-white">Our work — gallery</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-[11px] text-white/50 sm:justify-between">
            <span>© Sahara Cleaning Services · Since 2012 · GSTIN: {COMPANY.gstin}</span>
            <span>
              <Link href="/privacy-policy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Terms &amp; Conditions</Link>
            </span>
          </p>
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
 * Uses the primary customer number (CONTACT.call[0] / CONTACT.whatsapp = 8956567130).
 */
export function CallWhatsAppBar({ waText }: { waText: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
      <a href={`tel:+91${CONTACT.call[0]}`} className="flex items-center justify-center gap-1 py-3 text-primary"><Phone className="size-3.5" /> Call</a>
      <a href={waLink(waText, CONTACT.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-success py-3 text-white"><MessageCircle className="size-3.5" /> WhatsApp</a>
    </div>
  );
}

export const FESTIVAL_BADGE = "Festival Cleaning Packages";

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
  const reviews = settings?.googleReviewCount ? settings.googleReviewCount.replace(/\d+/, (d) => Number(d).toLocaleString("en-IN")) : null;
  return (
    <section className="bg-[#0a2540] text-white">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[1fr_1.1fr] md:items-center md:gap-8 md:px-4 md:py-10">
        <div className="relative aspect-[4/3] overflow-hidden md:order-2 md:aspect-square md:rounded-3xl lg:aspect-[5/4]">
          <LandingHeroCarousel images={images ?? heroImages(image, alt)} />
        </div>
        <div className="px-4 py-6 md:order-1 md:px-0 md:py-0">
          {(badge?.startsWith("Quotation") || festivalOn) && (
            <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#0a2540] sm:text-xs">
              {badge?.startsWith("Quotation") ? badge : FESTIVAL_BADGE}
            </p>
          )}
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">{subtitle.split(/(?<=\.)\s/)[0]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:text-xs">
              {settings?.googleRating && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[#0a2540]">
                  <FaGoogle className="size-3 text-[#4285F4]" aria-hidden /> {settings.googleRating}/5
                </span>
              )}
              {reviews && <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/90">{reviews} Google Reviews</span>}
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/90">Residential &amp; Commercial Services</span>
              {fromPrice != null && <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[#0a2540]">Full home deep cleaning from {inr(fromPrice)}</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={bookHref} className="relative rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/50 [animation-duration:2.2s]" aria-hidden />
              Book Now
            </Link>
            {/* Both customer numbers, each with Call + WhatsApp. */}
            {CONTACT.call.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-full bg-white/15 py-1 pl-3 pr-1 text-xs font-semibold">
                {n}
                <a href={`tel:+91${n}`} aria-label={`Call ${n}`} className="flex size-8 items-center justify-center rounded-full hover:bg-white/20"><Phone className="size-3.5" /></a>
                <a href={waLink(waText, n)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${n}`} className="flex size-8 items-center justify-center rounded-full bg-success hover:bg-success/90"><MessageCircle className="size-3.5" /></a>
              </span>
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

export async function QuoteSection({ title, subtitle, campaignName, defaultService, preset }: { title: string; subtitle: string; campaignName: string; defaultService?: string; preset?: { bhk: string; pkg: HomeTier } }) {
  const pricing = await getPublicPricing(); // painting rates are never sent to the public booking widget
  return (
    <section id="quote" className="scroll-mt-20">
      <h2 className="text-center text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mb-3 text-center text-sm text-[#0a2540]/70">{subtitle}</p>
      <BookingWizard campaignName={campaignName} defaultCategory={SERVICE_TO_CATEGORY[defaultService ?? ""]} preset={preset} pricing={pricing} />
    </section>
  );
}

/**
 * Compact festival hero (WhatsApp campaign traffic): headline, Google rating badge from
 * CRM Settings (no hard-coded claim — omitted when Settings is blank) and three actions.
 */
export async function CompactHero({ title, subtitle, waText, badge }: { title: string; subtitle?: string; waText: string; badge?: string | null }) {
  const settings = await getCompanySettings().catch(() => null);
  const rating = settings?.googleRating?.trim() || "";
  const reviews = settings?.googleReviewCount?.trim() ? settings.googleReviewCount.trim().replace(/\d+/, (d) => Number(d).toLocaleString("en-IN")) : "";
  return (
    <section className="relative overflow-hidden bg-[#0a2540] text-white">
      <img src="/marketing/festival-banner.webp" alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a2540]/60 to-[#0a2540]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:py-10">
        {badge && <p className="inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold text-[#0a2540]">{badge}</p>}
        <h1 className="mt-2 text-[26px] font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        {(rating || reviews) && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0a2540]">
            <FaGoogle className="size-3 text-[#4285F4]" aria-hidden />
            {rating && <>⭐ {rating}/5</>}
            {reviews && <span className="font-semibold text-[#0a2540]/70">({reviews} Google Reviews)</span>}
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={`tel:+91${CONTACT.call[0]}`} className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white text-[11px] font-bold leading-tight text-[#0a2540]">
            <span className="flex items-center gap-1"><Phone className="size-3.5" /> Call</span>
            <span className="text-[10px] font-semibold text-[#0a2540]/70">{CONTACT.call[0]}</span>
          </a>
          <a href={waLink(waText)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-success text-xs font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</a>
          <a href="#quote" className="flex min-h-12 items-center justify-center rounded-xl bg-amber-400 text-xs font-extrabold text-[#0a2540]">Book Online</a>
        </div>
      </div>
    </section>
  );
}

/** One-row process: Select Service → Pick Date → WhatsApp Confirmation. */
export function ProcessStepper() {
  const steps = ["Select Service", "Pick Date", "WhatsApp Confirmation"];
  return (
    <ol aria-label="How it works" className="flex items-center justify-between gap-1 rounded-2xl bg-white px-2 py-2.5 text-[11px] font-semibold shadow-sm">
      {steps.map((st, i) => (
        <li key={st} className="flex min-w-0 items-center gap-1">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white">{i + 1}</span>
          <span className="leading-tight">{st}</span>
          {i < steps.length - 1 && <span aria-hidden className="pl-0.5 text-primary">➔</span>}
        </li>
      ))}
    </ol>
  );
}

/** Single-line service-area badge. */
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
