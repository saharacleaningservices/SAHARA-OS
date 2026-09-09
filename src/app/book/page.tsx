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
  Home as HomeIcon,
  Building2,
  PaintRoller,
  Bug,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube, FaGoogle } from "react-icons/fa6";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { BookingStickyBar } from "@/components/public/booking-sticky-bar";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
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
  { label: "Gallery", href: "#gallery" },
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
  { icon: HomeIcon, label: "Home Cleaning" },
  { icon: Building2, label: "Commercial Cleaning" },
  { icon: PaintRoller, label: "Interior Painting" },
  { icon: Bug, label: "Pest Control" },
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
  searchParams: Promise<{ ref?: string; source?: string; src?: string; customer?: string; phone?: string; name?: string; mobile?: string }>;
}) {
  const sp = await searchParams;
  const [{ googleMaps }, settings] = await Promise.all([getResolvedIntegrations(), getCompanySettings()]);
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
          <CompanyLogo logoUrl={settings.logoUrl} className="h-9 w-auto max-w-[190px]" />
          <nav className="hidden items-center gap-6 text-sm font-medium text-foreground lg:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="hover:text-primary">{n.label}</a>
            ))}
          </nav>
          <a
            href={toWhatsAppLink(WHATSAPP_NUMBER)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <Phone className="size-4" />
            <span className="leading-tight">
              Call / WhatsApp
              <span className="block text-xs font-normal">{CALL_NUMBER}</span>
            </span>
          </a>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 sahara-gradient" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:py-14">
          <p className="font-serif text-2xl italic sm:text-3xl">Clean Home. Healthy Family. Happier You!</p>
          <p className="max-w-xl text-sm text-white/85 sm:text-base">
            Pune&apos;s trusted team for home &amp; commercial cleaning, interior painting and pest control —
            <span className="font-semibold"> professional, reliable, trusted.</span>
          </p>
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
              {SERVICES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-center shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                </div>
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
          <PublicBookingForm
            referralCode={sp.ref}
            mapsApiKey={googleMaps.apiKey}
            leadSource={leadSource}
            prefillName={prefillName}
            prefillMobile={prefillMobile}
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

      {/* ── Bottom trust row ──────────────────────────────────── */}
      <div id="gallery" className="border-y border-border bg-white">
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
            <CompanyLogo logoUrl={settings.logoUrl} className="h-9 w-auto max-w-[160px] brightness-0 invert" />
            <p className="text-sm">
              Making Pune Cleaner, Healthier &amp; Happier
              <span className="block text-xs text-white/80">One Home, One Office at a Time.</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://facebook.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF className="size-4" /></a>
            <a href="https://instagram.com/saharacleaningservices" target="_blank" rel="noreferrer" aria-label="Instagram"><FaInstagram className="size-4" /></a>
            <a href="https://youtube.com/@saharacleaningservices" target="_blank" rel="noreferrer" aria-label="YouTube"><FaYoutube className="size-4" /></a>
            {reviewUrl && <a href={reviewUrl} target="_blank" rel="noreferrer" aria-label="Google Reviews"><FaGoogle className="size-4" /></a>}
          </div>
          <p className="text-xs text-white/85">
            Trusted by <span className="font-semibold">{happyCustomers} Customers</span> Across Pune
          </p>
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
