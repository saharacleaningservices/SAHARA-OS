import { paymentDetailsFrom } from "@/lib/booking-payment";
import { customerNumberFor } from "@/server/customer-db";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, FunnelCards, CompactPriceSelector, CallWhatsAppBar, BASE_URL, CAROUSEL, ALL_SERVICES_SLIDES, businessJsonLd, faqJsonLd, breadcrumbBookingJsonLd, Faqs } from "@/components/public/landing-kit";
import { nearMeFaqs } from "@/lib/seo-schema";
import { BookingLinkPing } from "@/components/public/booking-link-ping";
import { BookingWizard, type QuotePrefill } from "@/components/public/booking-wizard";
import { getPublicPricing } from "@/server/pricing";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { BookingFooter } from "@/components/public/booking-footer";
import { ClientLogosSlider } from "@/components/public/client-logos-slider";
import { ReviewsCarousel, type Review } from "@/components/public/reviews-carousel";
import { campaignFestivalNames, todayIST } from "@/lib/pricing-master";

// Customer booking page in the approved transparent-pricing landing design.
// /booking                → pick a package, date, available slot, payment preference
// /booking?quote=<token>  → quotation booking: customer only picks date, slot, payment
// Submitting creates a booking REQUEST; the office confirms it in the CRM.

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ quote?: string }> }): Promise<Metadata> {
  const [{ quote }, pricing] = await Promise.all([searchParams, getPublicPricing()]);
  // Festival mention only while the Settings → Pricing campaign runs (same windows as the prices).
  const festivals = campaignFestivalNames(pricing.festivals, todayIST());
  return {
    title: "Cleaning Services Near Me in Pune – Book Deep Cleaning Slots | Sahara Cleaning Services",
    description: `Book home cleaning, commercial cleaning, pest control and interior painting across Pune & PCMC: transparent prices, real available slots, pay advance or after service.${festivals ? ` Festival cleaning slots for ${festivals.replace(/ • (?=[^•]*$)/, " and ").replace(/ • /g, ", ")}.` : ""}`,
    alternates: { canonical: `${BASE_URL}/booking` },
    robots: quote ? { index: false, follow: false } : undefined,
    openGraph: {
      title: "Book Professional Cleaning in Pune & PCMC — Sahara Cleaning Services",
      description: "Home cleaning, commercial cleaning, pest control and interior painting across Pune & PCMC. Transparent prices, real available slots, pay advance or after service.",
      url: `${BASE_URL}/booking`,
      siteName: "Sahara Cleaning Services",
      images: [`${BASE_URL}/marketing/hero-home.webp`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Book Professional Cleaning in Pune & PCMC — Sahara Cleaning Services",
      description: "Transparent prices, real available slots, pay advance or after service.",
      images: [`${BASE_URL}/marketing/hero-home.webp`],
    },
  };
}

const WA = "Hi Sahara, I'd like help with my booking.";

async function loadQuote(token?: string): Promise<QuotePrefill | null> {
  if (!token || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const q = await db.quotation.findFirst({
    where: { publicToken: token, status: { notIn: ["REJECTED", "CANCELLED", "EXPIRED"] } },
    include: { lead: { select: { name: true, mobile: true, deletedAt: true } } },
  });
  if (!q || q.lead.deletedAt) return null;
  let services: string[] = [];
  try {
    services = (JSON.parse(q.services) as { name?: string }[]).map((s) => s.name ?? "").filter(Boolean);
  } catch {
    services = [];
  }
  const customerNumber = await customerNumberFor(q.lead.mobile);
  return { token, quoteNumber: q.quoteNumber, customerName: q.lead.name, mobile: q.lead.mobile, customerNumber, services: services.length ? services : ["As per quotation"], totalAmount: q.totalAmount };
}

const CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { home: "HOME", commercial: "COMMERCIAL", pest: "PEST", painting: "PAINTING" };

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; service?: string; ref?: string; bl?: string; name?: string; mobile?: string; phone?: string; customer?: string }>;
}) {
  const { quote: quoteToken, service, ref, bl, name, customer, mobile, phone } = await searchParams;
  // Staff-sent personalised link (?bl=<token>): prefill from the link record, ping it as opened, tie the submission to it.
  const link = bl && /^[a-f0-9]{8,64}$/.test(bl) ? await db.bookingLink.findUnique({ where: { token: bl }, select: { customerName: true, customerMobile: true } }).catch(() => null) : null;
  const [settings, quote, pricing, galleryItems] = await Promise.all([getCompanySettings(), loadQuote(quoteToken), getPublicPricing(), getFeaturedGallery(12).catch(() => [])]);
  const festivalEyebrow = campaignFestivalNames(pricing.festivals, todayIST());
  // Real Google reviews the owner entered in Settings → Featured Reviews; none configured → no slider (never an invented testimonial).
  let featuredReviews: Review[] = [];
  try {
    const parsed = settings.featuredReviews ? JSON.parse(settings.featuredReviews) : [];
    if (Array.isArray(parsed)) featuredReviews = parsed.filter((r) => r && r.text && r.name).slice(0, 8);
  } catch {
    featuredReviews = [];
  }

  return (
    // On a quotation link, Book Now scrolls to the wizard on THIS page (keeps ?quote=).
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={quote ? [businessJsonLd()] : [businessJsonLd(), faqJsonLd(nearMeFaqs()), breadcrumbBookingJsonLd()]} mobileBar={<CallWhatsAppBar waText={WA} />} footer={<BookingFooter />} {...(quote ? { bookHref: "#book" } : {})}>
      <Hero
        {...(quote ? { bookHrefOverride: "#book" } : {})}
        image={CAROUSEL.home.src}
        alt={CAROUSEL.home.alt}
        images={ALL_SERVICES_SLIDES}
        eyebrow={quote ? `Quotation ${quote.quoteNumber}` : festivalEyebrow ? `${festivalEyebrow} · Festival cleaning` : "Serving Pune Since 2012"}
        badge={quote ? `Quotation ${quote.quoteNumber}` : undefined}
        title={quote ? `Book your service, ${quote.customerName.split(" ")[0]}` : "Pune's Most Trusted Cleaning Service Provider — Residential & Commercial"}
        subtitle={quote ? "Pick a date, an available time slot and your payment preference." : "Verified Staff | Transparent Pricing | Pay After Service"}
        primaryLabel="Choose Date & Slot"
        variant="booking"
        primaryHref="#book"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {quoteToken && !quote && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This quotation link is no longer valid. You can still book below, or call us on 8956567130 / 7083347130.</p>
        )}
        {!quote && (
          <>
            <FunnelCards />
            <CompactPriceSelector />
          </>
        )}
        {/* Drag / touch Before–After transformation slider inside the booking flow (owner 2026-10-25). */}
        {!quote && galleryItems.length > 0 && <BeforeAfterGallery items={galleryItems} />}
        <section id="book" className="scroll-mt-20">
          {link && <BookingLinkPing token={bl} />}
          <BookingWizard
            quote={quote}
            defaultCategory={CATEGORY[service ?? ""]}
            hidePicker={!quote}
            referralCode={ref}
            prefill={{ name: link?.customerName || name || customer, mobile: link?.customerMobile ? link.customerMobile.replace(/\D/g, "").slice(-10) : mobile ?? phone }}
            bookingLinkToken={link ? bl : undefined}
            pricing={pricing}
            paymentDetails={paymentDetailsFrom(settings)}
          />
        </section>
        {!quote && (
          <>
            {/* Social proof (owner 2026-10-26): corporate logos, then real Google reviews; the FAQs sit last, right above the footer. */}
            <ClientLogosSlider />
            {featuredReviews.length > 0 && <ReviewsCarousel reviews={featuredReviews} reviewUrl={settings.googleReviewUrl || undefined} />}
            <Faqs faqs={nearMeFaqs()} compact />
          </>
        )}
      </main>
      <FloatingCallButton />
    </LandingShell>
  );
}

// Floating pulsing call button (bottom-right) — same as saharacleaningservices.com.
// Sits above the mobile Call/WhatsApp bar on small screens.
const FCALL_CSS = `
#sh-fcall{position:fixed;right:20px;bottom:24px;z-index:60;width:58px;height:58px;border-radius:50%;background:linear-gradient(145deg,#2563EB,#1D4ED8);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(29,78,216,.45);border:3px solid #fff;text-decoration:none}
#sh-fcall svg{width:26px;height:26px;position:relative;z-index:2;animation:shRing 2.4s ease-in-out infinite}
#sh-fcall:before,#sh-fcall:after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid rgba(37,99,235,.6);animation:shWave 2s cubic-bezier(.2,.6,.3,1) infinite;z-index:1}
#sh-fcall:after{animation-delay:1s}
@keyframes shWave{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.7);opacity:0}}
@keyframes shRing{0%,60%,100%{transform:rotate(0)}5%,15%,25%{transform:rotate(-14deg)}10%,20%,30%{transform:rotate(14deg)}}
@media(max-width:639px){#sh-fcall{right:14px;bottom:calc(60px + env(safe-area-inset-bottom));width:54px;height:54px}}
@media(prefers-reduced-motion:reduce){#sh-fcall:before,#sh-fcall:after,#sh-fcall svg{animation:none}}
`;

function FloatingCallButton() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FCALL_CSS }} />
      <a id="sh-fcall" href="tel:+917083347130" aria-label="Call Sahara Cleaning Services on +91 70833 47130">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
        </svg>
      </a>
    </>
  );
}
