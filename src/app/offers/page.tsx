import type { Metadata } from "next";
import { activeCampaign, homeFromPrice, todayIST } from "@/lib/pricing-master";
import { getLivePricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, CompactHero, ProcessStepper, AreasBadge, QuoteSection, Faqs, BASE_URL, businessJsonLd, faqJsonLd, packageSlug } from "@/components/public/landing-kit";
import { OffersTabs, type CategoryCard, type HomeRow } from "@/components/public/offers-tabs";
import { livePkgs, inr } from "@/lib/marketing-content";

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

// The four core categories (order as the owner specified). CTAs open the booking
// form with that service selected — inspection-based services quote after a visit.
const CATEGORIES: CategoryCard[] = [
  { key: "commercial", label: "Office & Commercial", title: "Office & Commercial Cleaning", text: "Offices, workspaces and commercial premises — site visit and quote.", cta: "Get Quote", href: "/booking?service=commercial#book", img: "/marketing/hero-commercial.webp" },
  { key: "painting", label: "Interior Painting", title: "Interior Painting", text: "Asian Paints range — free site inspection and a measurement-based quote.", cta: "Book Free Inspection", href: "/booking?service=painting#book", img: "/marketing/hero-painting.webp" },
  { key: "pest", label: "Pest Control", title: "Pest Control", text: "Cockroach, termite, bed bug and ant control after inspection.", cta: "Book Inspection", href: "/booking?service=pest#book", img: "/marketing/hero-pest.webp" },
];

export default async function FestivalOffersPage() {
  const [settings, pricing] = await Promise.all([getCompanySettings(), getLivePricing()]);
  const campaign = activeCampaign(pricing.festivals, todayIST());
  // Same price source as before: pricing master + the active festival window (festival price only while it runs).
  const PREMIUM = livePkgs(pricing.items, "PREMIUM", campaign?.current);
  const PLATINUM = livePkgs(pricing.items, "PLATINUM", campaign?.current);
  const home: HomeRow[] = ["1 BHK", "2 BHK", "3 BHK"].map((bhk) => {
    const pr = PREMIUM.find((p) => p.bhk === bhk)?.price ?? null;
    const pl = PLATINUM.find((p) => p.bhk === bhk)?.price ?? null;
    return {
      bhk,
      premium: pr,
      platinum: pl,
      premiumHref: pr != null ? `/home-deep-cleaning-pune/${packageSlug(bhk, "Premium")}` : null,
      platinumHref: pl != null ? `/home-deep-cleaning-pune/${packageSlug(bhk, "Platinum")}` : null,
    };
  });
  const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const priceNote = campaign
    ? `${campaign.windows.map((w) => w.name).join(" · ")} prices for service dates ${day(campaign.start)} – ${day(campaign.end)}. Platinum adds wall wet cleaning. Slots subject to team availability.`
    : "Regular package prices. Platinum adds wall wet cleaning.";
  const faqs = campaign ? FAQS.filter((f) => !/festival and regular/i.test(f.q)) : FAQS;
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(faqs)]} bookHref="#quote">
      <CompactHero
        title="Get Your Home & Workplace Festival-Ready"
        badge={campaign ? `🪔 ${campaign.windows.map((w) => w.name).join(" · ")}` : null}
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <ProcessStepper />
        <OffersTabs home={home} priceNote={priceNote} homeCta={campaign ? "Book Festival Cleaning" : "Book Online"} categories={CATEGORIES} />
        <QuoteSection title="Book online" subtitle="Pick a service, date and time — we confirm on WhatsApp." campaignName="Sahara Festival 2026" defaultService="HOME_DEEP_CLEANING" />
        <AreasBadge />
        <Faqs faqs={faqs} compact />
      </main>
    </LandingShell>
  );
}
