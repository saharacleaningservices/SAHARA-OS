import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, HowItWorks, Faqs, Terms, OtherServices, BASE_URL, CAROUSEL, ALL_SERVICES_SLIDES, businessJsonLd, faqJsonLd, FestivalSection } from "@/components/public/landing-kit";
import { BookingWizard, type QuotePrefill } from "@/components/public/booking-wizard";
import { getLivePricing } from "@/server/pricing";

// Customer booking page in the approved transparent-pricing landing design.
// /booking                → pick a package, date, available slot, payment preference
// /booking?quote=<token>  → quotation booking: customer only picks date, slot, payment
// Submitting creates a booking REQUEST; the office confirms it in the CRM.

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ quote?: string }> }): Promise<Metadata> {
  const { quote } = await searchParams;
  return {
    title: "Book Professional Cleaning in Pune & PCMC – Available Slots | Sahara Cleaning Services",
    description: "Book home cleaning, commercial cleaning, pest control and interior painting across Pune & PCMC: transparent prices, real available slots, pay advance or after service. Festival cleaning slots for Navratri, Dussehra and Diwali.",
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
const FAQS = [
  { q: "Is my booking confirmed when I submit the form?", a: "No — it's a booking request. Our team checks the slot and confirms it; you then receive the confirmation with your booking link on WhatsApp." },
  { q: "How are available slots decided?", a: "Slots come from our live booking calendar and team capacity. Dates and times that are already full can't be selected." },
  { q: "Can I pay after the service?", a: "Yes. Choose Pay After Service, or choose Pay Advance to secure your slot — payment details are on your booking page." },
  { q: "What is the difference between Premium and Platinum?", a: "Both include the same complete cleaning scope. Premium includes wall dry dusting; Platinum includes wall wet cleaning. Both include ceiling dry dusting." },
  { q: "Are there minimum quantities?", a: "Sofa cleaning needs a minimum of 5 seats, bathroom cleaning 2 bathrooms and mattress cleaning 2 mattresses." },
];

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
  return { token, quoteNumber: q.quoteNumber, customerName: q.lead.name, mobile: q.lead.mobile, services: services.length ? services : ["As per quotation"], totalAmount: q.totalAmount };
}

const CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { home: "HOME", commercial: "COMMERCIAL", pest: "PEST", painting: "PAINTING" };

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; service?: string; ref?: string; name?: string; mobile?: string; phone?: string; customer?: string }>;
}) {
  const { quote: quoteToken, service, ref, name, customer, mobile, phone } = await searchParams;
  const [settings, quote, pricing] = await Promise.all([getCompanySettings(), loadQuote(quoteToken), getLivePricing()]);

  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}>
      <Hero
        image={CAROUSEL.team.src}
        alt={CAROUSEL.team.alt}
        images={ALL_SERVICES_SLIDES}
        eyebrow={quote ? `Quotation ${quote.quoteNumber}` : "Navratri • Dussehra • Diwali · Festival cleaning"}
        badge={quote ? `Quotation ${quote.quoteNumber}` : undefined}
        title={quote ? `Book your service, ${quote.customerName.split(" ")[0]}` : "Professional Cleaning in Pune & PCMC"}
        subtitle={quote ? "Pick a date, an available time slot and your payment preference." : "Transparent prices, real available slots, and pay advance or after service. Book early to get your preferred festival slot."}
        primaryLabel="Choose Date & Slot"
        primaryHref="#book"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {quoteToken && !quote && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This quotation link is no longer valid. You can still book below, or call us on 8956567130 / 7083347130.</p>
        )}
        {!quote && <FestivalSection bookHref="?price=festival#book" />}
        <section id="book" className="scroll-mt-20">
          <BookingWizard
            quote={quote}
            defaultCategory={CATEGORY[service ?? ""]}
            referralCode={ref}
            prefill={{ name: name ?? customer, mobile: mobile ?? phone }}
            pricing={pricing}
          />
        </section>

        <HowItWorks />
        <Faqs faqs={FAQS} />
        <Terms />
        <OtherServices current="/booking" />
      </main>
    </LandingShell>
  );
}
