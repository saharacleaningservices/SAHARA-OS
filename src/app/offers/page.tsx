import type { Metadata } from "next";
import { activeCampaign, homeFromPrice, todayIST } from "@/lib/pricing-master";
import { getLivePricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, FunnelCards, CompactPriceSelector, AreasBadge, QuoteSection, Faqs, BASE_URL, CAROUSEL, ALL_SERVICES_SLIDES, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { inr } from "@/lib/marketing-content";

// Festival campaign hub (Navratri · Dussehra · Diwali) — the WhatsApp campaign
// lands here and customers pick a service page.

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

// "From" price = what a customer actually pays now (festival price while the campaign runs).
async function fromPriceNow() {
  const { items, festivals } = await getLivePricing();
  return homeFromPrice(items, activeCampaign(festivals, todayIST())?.current ?? null);
}

export async function generateMetadata(): Promise<Metadata> {
  const from = await fromPriceNow();
  return {
    title: "Festival Home & Office Cleaning in Pune – Navratri, Dussehra, Diwali | Sahara",
    description: `Get your home and workplace festival-ready with Sahara Cleaning Services, Pune. Home deep cleaning from ${inr(from)}, office cleaning, pest control and interior painting. Since 2012.`,
    alternates: { canonical: `${BASE_URL}/offers` },
    openGraph: { title: "Get Your Home & Workplace Festival-Ready — Sahara Cleaning Services", description: `Navratri • Dussehra • Diwali. Transparent home deep cleaning prices from ${inr(from)}.`, url: `${BASE_URL}/offers`, images: [`${BASE_URL}/marketing/hero-home.webp`], type: "website" },
  };
}

const WA = "Hi Sahara, I'd like to book festival cleaning. Please share details.";
const FAQS = [
  { q: "Why book festival cleaning early?", a: "Navratri, Dussehra and Diwali are the busiest cleaning weeks of the year. Booking early helps you get your preferred date." },
  { q: "What is the difference between festival and regular prices?", a: "Festival prices apply to service dates during Navratri, Dussehra and Diwali, our busiest weeks. Regular prices apply on all other dates. The booking form shows both, and your booking keeps the price you confirmed." },
  { q: "What is the difference between Premium and Platinum?", a: "Platinum includes everything in Premium plus wall wet cleaning and ceiling dry dusting." },
  { q: "Do you clean offices and shops too?", a: "Yes — offices, workspaces and commercial premises. We visit the site and share a quote." },
  { q: "Which areas do you cover?", a: "We serve Pune and Pimpri-Chinchwad (PCMC). Standard package prices apply to our standard serviceable areas; additional charges may apply for locations outside it, depending on distance and requirements." },
];

// Same funnel as /booking, in the same order: Hero → 4 service cards → compact price selector → booking form with
// its live summary. Only the SEO extras below the form (areas + FAQs) are specific to this page.
export default async function FestivalOffersPage() {
  const [settings, pricing] = await Promise.all([getCompanySettings(), getLivePricing()]);
  const campaign = activeCampaign(pricing.festivals, todayIST());
  const faqs = campaign ? FAQS.filter((f) => !/festival and regular/i.test(f.q)) : FAQS;
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(faqs)]} bookHref="#book">
      <Hero
        bookHrefOverride="#book"
        image={CAROUSEL.team.src}
        alt={CAROUSEL.team.alt}
        images={ALL_SERVICES_SLIDES}
        title="Pune's Most Trusted Cleaning Service Provider — Residential & Commercial"
        subtitle="Verified Staff | Transparent Pricing | Pay After Service"
        primaryLabel="Choose Date & Slot"
        primaryHref="#book"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <FunnelCards />
        <CompactPriceSelector />
        <QuoteSection title="Book online" subtitle="Pick a service, date and time — we confirm on WhatsApp." campaignName="Sahara Festival 2026" hidePicker />
        <AreasBadge />
        <Faqs faqs={faqs} compact />
      </main>
    </LandingShell>
  );
}
