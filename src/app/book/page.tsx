import Link from "next/link";
import {
  Phone,
  Star,
  Users,
  ShieldCheck,
  ShieldCheck as ShieldIcon,
  Leaf,
  Clock3,
  Settings2,
  Smile,
  Headphones,
  CalendarClock,
  IndianRupee,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube, FaGoogle } from "react-icons/fa6";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { BookingStickyBar } from "@/components/public/booking-sticky-bar";
import { BookingLinkPing } from "@/components/public/booking-link-ping";
import {
  HeroArt,
  HomeCleaningArt,
  CommercialCleaningArt,
  InteriorPaintingArt,
  PestControlArt,
} from "@/components/public/service-illustrations";
import { CompanyLogo } from "@/components/shared/company-logo";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { COMPANY } from "@/lib/constants";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { toWhatsAppLink } from "@/lib/utils";

export const metadata = {
  title: "Book a Service — Sahara Cleaning Services, Pune",
  description: "Pune's trusted cleaning experts — Home, Commercial, Interior Painting & Pest Control.",
};

const CALL_NUMBER = "7083347130";
const WHATSAPP_NUMBER = "8956567130";

const NAV = [
  { label: "Home", href: "#top" },
  { label: "Our Services", href: "#services" },
  { label: "Reviews", href: "#reviews" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "#contact" },
];

const WHY = [
  { icon: ShieldCheck, label: "Trained & Verified Staff" },
  { icon: Leaf, label: "Eco-Friendly Products" },
  { icon: Clock3, label: "On-Time Service" },
  { icon: Settings2, label: "Modern Equipment" },
  { icon: Smile, label: "100% Customer Satisfaction" },
];

const SERVICES = [
  { art: HomeCleaningArt, label: "Home Deep Cleaning", desc: "Kitchen, bath, sofa, full home" },
  { art: CommercialCleaningArt, label: "Commercial Cleaning", desc: "Office, shop, warehouse, more" },
  { art: InteriorPaintingArt, label: "Interior Painting", desc: "Emulsion, lustre, texture" },
  { art: PestControlArt, label: "Pest Control", desc: "Cockroach, termite, bed bugs" },
];

const BOTTOM_TRUST = [
  { icon: ShieldIcon, title: "Safe & Secure Booking", sub: "Your data is protected" },
  { icon: Headphones, title: "Quick Support", sub: "We're always here to help" },
  { icon: CalendarClock, title: "Flexible Scheduling", sub: "Choose your convenient time" },
  { icon: IndianRupee, title: "Transparent Pricing", sub: "No hidden charges" },
];

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; source?: string; src?: string; customer?: string; phone?: string; name?: string; mobile?: string; bl?: string }>;
}) {
  const sp = await searchParams;
  const [{ googleMaps }, settings, galleryItems] = await Promise.all([
    getResolvedIntegrations(),
    getCompanySettings(),
    getFeaturedGallery(24),
  ]);
  const leadSource = (sp.source || sp.src || "").toUpperCase();
  const rating = settings.googleRating || "4.9";
  const reviewCount = settings.googleReviewCount || "1800+";
  const happyCustomers = settings.happyCustomers || "8000+";
  const reviewUrl = settings.googleReviewUrl || "";
  const prefillName = (sp.customer || sp.name || "").slice(0, 80);
  const prefillMobile = (sp.phone || sp.mobile || "").replace(/[^\d]/g, "").slice(-10);

  let featured: { name: string; text: string; rating?: number }[] = [];
  try {
    const parsed = settings.featuredReviews ? JSON.parse(settings.featuredReviews) : [];
    if (Array.isArray(parsed)) featured = parsed.filter((r) => r && r.text && r.name).slice(0, 5);
  } catch {
    featured = [];
  }
  const testimonial = featured[0] ?? {
    name: "Priya Sharma",
    text: "Excellent service! Very professional team and great results. Highly recommended!",
    rating: 5,
  };

  return (
    <div id="top" className="min-h-screen bg-[#eef4fb] pb-20 lg:pb-0">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header id="contact" className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <CompanyLogo logoUrl={settings.logoUrl} className="h-[46px] w-auto max-w-[180px]" showTm />
          <nav className="hidden items-center gap-6 text-sm font-medium text-foreground lg:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="hover:text-primary">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={`tel:+91${CALL_NUMBER}`}
              className="sahara-pulse flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm sm:text-sm"
            >
              <Phone className="size-4" />
              <span className="leading-tight">Call<span className="block font-normal">{CALL_NUMBER}</span></span>
            </a>
            <a
              href={toWhatsAppLink(WHATSAPP_NUMBER)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-white shadow-sm sm:text-sm"
            >
              <Phone className="size-4" />
              <span className="leading-tight">WhatsApp<span className="block font-normal">{WHATSAPP_NUMBER}</span></span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 sahara-gradient" />
        <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 opacity-90 lg:block">
          <HeroArt className="h-full w-full" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 py-10 sm:py-14 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="font-serif text-2xl italic sm:text-4xl">Clean Home. Healthy Family. Happier You!</p>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Pune&apos;s trusted team for home &amp; commercial cleaning, interior painting and pest control —
              <span className="font-semibold"> professional, reliable, trusted.</span>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              <a href="#book" className="rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow-lg">Book Now</a>
              {reviewUrl && (
                <a href={reviewUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  View Google Reviews
                </a>
              )}
            </div>
          </div>
          <div className="lg:hidden">
            <HeroArt className="mx-auto h-40 w-full max-w-sm" />
          </div>
        </div>
      </section>

      {/* ── Trust strip ───────────────────────────────────────── */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-4 text-sm sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <Star className="size-6 shrink-0 fill-yellow-400 text-yellow-400" />
            <span><span className="block font-bold text-foreground">{rating}/5</span><span className="text-xs text-muted-foreground">Google Rating</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-6 shrink-0 text-primary" />
            <span><span className="block font-bold text-foreground">{reviewCount}</span><span className="text-xs text-muted-foreground">Google Reviews</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-6 shrink-0 text-primary" />
            <span><span className="block font-bold text-foreground">{happyCustomers}</span><span className="text-xs text-muted-foreground">Happy Customers</span></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 shrink-0 text-primary" />
            <span><span className="block font-bold text-foreground">Pune&apos;s Trusted</span><span className="text-xs text-muted-foreground">Cleaning Service</span></span>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <section>
            <h3 className="mb-3 text-xl font-bold text-foreground">Why Choose Sahara?</h3>
            <ul className="space-y-2.5">
              {WHY.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <section id="services">
            <h3 className="mb-3 text-xl font-bold text-foreground">Our Services</h3>
            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map(({ art: Art, label, desc }) => (
                <a
                  key={label}
                  href="#book"
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition active:scale-[0.97]"
                >
                  <div className="h-20 w-full">
                    <Art className="h-full w-full transition group-hover:scale-105" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
                    <span className="mt-1.5 inline-block text-[11px] font-semibold text-primary">Book Now →</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section id="reviews" className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-1.5 flex items-center gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
            </div>
            <p className="text-sm text-foreground">&ldquo;{testimonial.text}&rdquo;</p>
            <p className="mt-2 text-sm font-semibold text-foreground">— {testimonial.name}</p>
            <p className="text-xs text-muted-foreground">Verified Google Review</p>
            {reviewUrl && (
              <a href={reviewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <FaGoogle className="size-3.5" /> Read all Google Reviews
              </a>
            )}
          </section>
        </aside>

        {/* Form */}
        <div id="book" className="scroll-mt-20">
          {sp.ref && (
            <p className="mb-3 rounded-lg bg-accent p-2 text-center text-xs font-medium text-accent-foreground">
              Referred by a friend — code {sp.ref} applied
            </p>
          )}
          <BookingLinkPing token={sp.bl} />
          <PublicBookingForm
            referralCode={sp.ref}
            mapsApiKey={googleMaps.apiKey}
            leadSource={leadSource}
            prefillName={prefillName}
            prefillMobile={prefillMobile}
            bookingLinkToken={sp.bl}
            paymentDetails={{
              upiId: settings.upiId ?? null,
              upiQrUrl: settings.upiQrUrl ?? null,
              bankName: settings.bankName ?? null,
              bankAccountName: settings.bankAccountName ?? null,
              bankAccountNumber: settings.bankAccountNumber ?? null,
              bankIfsc: settings.bankIfsc ?? null,
            }}
          />
        </div>
      </main>

      {/* ── Before & After gallery ────────────────────────────── */}
      {galleryItems.length > 0 && (
        <section id="gallery" className="scroll-mt-20 border-y border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <BeforeAfterGallery items={galleryItems} />
            <div className="mt-5 text-center">
              <a href="/gallery" target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">
                See all our work →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom trust row ──────────────────────────────────── */}
      <div className="border-y border-border bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {BOTTOM_TRUST.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="text-white sahara-gradient">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-11 w-auto max-w-[170px] brightness-0 invert" showTm />
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            <p className="text-sm font-semibold">Residential &amp; Commercial Cleaning Services</p>
            <div className="flex items-center gap-4">
              <a href="https://facebook.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:opacity-80"><FaFacebookF className="size-4" /></a>
              <a href="https://instagram.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:opacity-80"><FaInstagram className="size-4" /></a>
              <a href="https://youtube.com/@saharacleaningservices" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:opacity-80"><FaYoutube className="size-4" /></a>
              <a href={reviewUrl || "https://www.google.com/maps/search/Sahara+Cleaning+Services+Pune"} target="_blank" rel="noreferrer" aria-label="Google Business Profile" className="hover:opacity-80"><FaGoogle className="size-4" /></a>
            </div>
            <p className="text-xs text-white/85">Trusted by <span className="font-semibold">{happyCustomers} Customers</span> Across Pune</p>
          </div>
        </div>
        <div className="border-t border-white/15 py-2 text-center text-[11px] text-white/70">
          <Link href="/login" className="hover:text-white">Staff login</Link>
          <span className="mx-2">·</span>
          {COMPANY.name}
          <sup className="ml-0.5 text-[0.7em]">™</sup>
        </div>
      </footer>

      <BookingStickyBar callNumber={CALL_NUMBER} whatsappNumber={WHATSAPP_NUMBER} reviewUrl={reviewUrl} />
    </div>
  );
}
