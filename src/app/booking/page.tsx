import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, Terms, CallWhatsAppBar, BASE_URL, CAROUSEL, ALL_SERVICES_SLIDES, businessJsonLd } from "@/components/public/landing-kit";
import { ServiceCards } from "@/components/public/service-cards";
import { BookingWizard, type QuotePrefill } from "@/components/public/booking-wizard";
import { getPublicPricing } from "@/server/pricing";

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
  const [settings, quote, pricing] = await Promise.all([getCompanySettings(), loadQuote(quoteToken), getPublicPricing()]);

  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd()]} mobileBar={<CallWhatsAppBar waText={WA} />}>
      <Hero
        image={CAROUSEL.team.src}
        alt={CAROUSEL.team.alt}
        images={ALL_SERVICES_SLIDES}
        eyebrow={quote ? `Quotation ${quote.quoteNumber}` : "Navratri • Dussehra • Diwali · Festival cleaning"}
        badge={quote ? `Quotation ${quote.quoteNumber}` : undefined}
        title={quote ? `Book your service, ${quote.customerName.split(" ")[0]}` : "Professional Cleaning Services in Pune"}
        subtitle={quote ? "Pick a date, an available time slot and your payment preference." : "Trained teams, real available slots, pay advance or after service."}
        primaryLabel="Choose Date & Slot"
        primaryHref="#book"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {quoteToken && !quote && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This quotation link is no longer valid. You can still book below, or call us on 8956567130 / 7083347130.</p>
        )}
        {!quote && (
          <ServiceCards
            starts={{
              HOME: (() => {
                const b = pricing.items.find((i) => i.group === "CUSTOMISED" && /bathroom/i.test(i.name) && i.price != null);
                return b ? `Starting from ₹${b.price!.toLocaleString("en-IN")} · Bathroom Cleaning` : undefined;
              })(),
              // No painting rate is published: painting is quoted after a free site inspection.
              PAINTING: "Free Site Inspection",
            }}
          />
        )}
        <section id="book" className="scroll-mt-20">
          <BookingWizard
            quote={quote}
            defaultCategory={CATEGORY[service ?? ""]}
            referralCode={ref}
            prefill={{ name: name ?? customer, mobile: mobile ?? phone }}
            pricing={pricing}
          />
        </section>

        <Terms />
      </main>
    </LandingShell>
  );
}
