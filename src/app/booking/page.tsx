import { paymentDetailsFrom } from "@/lib/booking-payment";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, FunnelCards, CompactPriceSelector, CallWhatsAppBar, BASE_URL, CAROUSEL, ALL_SERVICES_SLIDES, businessJsonLd } from "@/components/public/landing-kit";
import { BookingWizard, type QuotePrefill } from "@/components/public/booking-wizard";
import { getPublicPricing } from "@/server/pricing";
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
    title: "Book Professional Cleaning in Pune & PCMC – Available Slots | Sahara Cleaning Services",
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
  const festivalEyebrow = campaignFestivalNames(pricing.festivals, todayIST());

  return (
    // On a quotation link, Book Now scrolls to the wizard on THIS page (keeps ?quote=).
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd()]} mobileBar={<CallWhatsAppBar waText={WA} />} {...(quote ? { bookHref: "#book" } : {})}>
      <Hero
        {...(quote ? { bookHrefOverride: "#book" } : {})}
        image={CAROUSEL.team.src}
        alt={CAROUSEL.team.alt}
        images={ALL_SERVICES_SLIDES}
        eyebrow={quote ? `Quotation ${quote.quoteNumber}` : festivalEyebrow ? `${festivalEyebrow} · Festival cleaning` : "Serving Pune Since 2012"}
        badge={quote ? `Quotation ${quote.quoteNumber}` : undefined}
        title={quote ? `Book your service, ${quote.customerName.split(" ")[0]}` : "Pune's Most Trusted Cleaning Service Provider — Residential & Commercial"}
        subtitle={quote ? "Pick a date, an available time slot and your payment preference." : "Verified Staff | Transparent Pricing | Pay After Service"}
        primaryLabel="Choose Date & Slot"
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
        <section id="book" className="scroll-mt-20">
          <BookingWizard
            quote={quote}
            defaultCategory={CATEGORY[service ?? ""]}
            hidePicker={!quote}
            referralCode={ref}
            prefill={{ name: name ?? customer, mobile: mobile ?? phone }}
            pricing={pricing}
            paymentDetails={paymentDetailsFrom(settings)}
          />
        </section>
      </main>
    </LandingShell>
  );
}
