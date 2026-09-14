import Image from "next/image";
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
import { HeroCarousel } from "@/components/public/hero-carousel";
import { CompanyLogo } from "@/components/shared/company-logo";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { COMPANY, CATEGORIES } from "@/lib/constants";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { toWhatsAppLink } from "@/lib/utils";

export const metadata = {
  title: "Book a Service — Sahara Cleaning Services, Pune",
  description: "Pune's trusted cleaning experts — Home, Commercial, Interior Painting & Pest Control.",
};

// Both numbers live in one place (src/lib/constants.ts) so the header, the
// footer and the mobile sticky bar can never drift out of sync.
const CALL_NUMBER = COMPANY.phones[0];
const WHATSAPP_NUMBER = COMPANY.phones[1];

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

// Card image/description + the Service Category value each maps to in
// PublicBookingForm's CATEGORIES — clicking a card scrolls to the form below
// with that category already selected (?category=... deep link). Images are
// the real, committed brand photography under /public/brand/services.
const SERVICES = [
  { img: "/brand/services/home-cleaning.png", label: "Home Deep Cleaning", desc: "Kitchen, bath, sofa, full home", cat: "HOME_DEEP_CLEANING" },
  { img: "/brand/services/office-cleaning.png", label: "Commercial Cleaning", desc: "Office, shop, warehouse, more", cat: "COMMERCIAL_CLEANING" },
  { img: "/brand/services/interior-painting.png", label: "Interior Painting", desc: "Emulsion, lustre, texture", cat: "PAINTING" },
  { img: "/brand/services/pest-control.png", label: "Pest Control", desc: "Cockroach, termite, bed bugs", cat: "PEST_CONTROL" },
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
  searchParams: Promise<{ ref?: string; source?: string; src?: string; customer?: string; phone?: string; name?: string; mobile?: string; bl?: string; category?: string }>;
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
  // Only accept a category that PublicBookingForm actually offers — anything
  // else (or a missing param) is simply ignored and the form starts blank.
  const initialCategory = CATEGORIES.some((c) => c.value === sp.category) ? sp.category : undefined;

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
      {/* ── Header ────────────────────────────────────────────── */}
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
        <div className="absolute right-0 top-0 hidden h-full w-1/2 p-8 lg:block">
          <HeroCarousel className="h-full w-full" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 py-10 sm:py-14 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="font-serif text-2xl italic sm:text-4xl">Clean Home. Healthy Family. Happier You!</p>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Pune&apos;s trusted team for home &amp; commercial cleaning, interior painting and pest control —
              <span className="font-semibold"> professional, reliable, trusted.</span>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              <a href="#book" className="sahara-pulse rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow-lg">Book Now</a>
              {reviewUrl && (
                <a href={reviewUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  View Google Reviews
                </a>
              )}
            </div>
          </div>
          <div className="lg:hidden">
            <HeroCarousel className="mx-auto h-40 w-full max-w-sm" />
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
          <section id="about">
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
              {SERVICES.map(({ img, label, desc, cat }) => (
                <Link
                  key={label}
                  href={`/book?category=${cat}#book`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition active:scale-[0.97]"
                >
                  <div className="relative h-20 w-full overflow-hidden">
                    <Image
                      src={img}
                      alt={label}
                      fill
                      sizes="200px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
                    <span className="mt-1.5 inline-block text-[11px] font-semibold text-primary">Book Now →</span>
                  </div>
                </Link>
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
            initialCategory={initialCategory}
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

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="text-white sahara-gradient">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-11 w-auto max-w-[170px] brightness-0 invert" showTm />
            <p className="max-w-xs text-xs leading-relaxed text-white/75">
              Residential &amp; Commercial Cleaning Services — trusted by{" "}
              <span className="font-semibold text-white">{happyCustomers} customers</span> across Pune.
            </p>
            <div className="flex items-center gap-4 pt-1">
              <a href="https://facebook.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:opacity-80"><FaFacebookF className="size-4" /></a>
              <a href="https://instagram.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:opacity-80"><FaInstagram className="size-4" /></a>
              <a href="https://youtube.com/@saharacleaningservices" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:opacity-80"><FaYoutube className="size-4" /></a>
              <a href={reviewUrl || "https://www.google.com/maps/search/Sahara+Cleaning+Services+Pune"} target="_blank" rel="noreferrer" aria-label="Google Business Profile" className="hover:opacity-80"><FaGoogle className="size-4" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Quick Links</p>
            <ul className="space-y-1.5 text-white/85">
              <li><a href="#top" className="hover:text-white">Home</a></li>
              <li><a href="#about" className="hover:text-white">About</a></li>
              <li><a href="#reviews" className="hover:text-white">Reviews</a></li>
              <li><a href="#contact" className="hover:text-white">Contact</a></li>
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Services</p>
            <ul className="space-y-1.5 text-white/85">
              <li><Link href="/book?category=HOME_DEEP_CLEANING#book" className="hover:text-white">Home Cleaning</Link></li>
              <li><Link href="/book?category=PAINTING#book" className="hover:text-white">Interior Painting</Link></li>
              <li><Link href="/book?category=PEST_CONTROL#book" className="hover:text-white">Pest Control</Link></li>
              <li><Link href="/book?category=COMMERCIAL_CLEANING#book" className="hover:text-white">Commercial Cleaning</Link></li>
              <li><a href="#book" className="hover:text-white">AMC</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Contact</p>
            <ul className="space-y-1.5 text-white/85">
              {COMPANY.phones.map((p) => (
                <li key={p}><a href={`tel:+91${p}`} className="hover:text-white">{p}</a></li>
              ))}
              <li><a href={`mailto:${COMPANY.email}`} className="break-all hover:text-white">{COMPANY.email}</a></li>
              <li className="text-white/70">{COMPANY.address}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 py-2 text-center text-[11px] text-white/70">
          {COMPANY.name}
          <sup className="ml-0.5 text-[0.7em]">™</sup>
        </div>
      </footer>

      <BookingStickyBar callNumber={CALL_NUMBER} whatsappNumber={WHATSAPP_NUMBER} reviewUrl={reviewUrl} />
    </div>
  );
}
