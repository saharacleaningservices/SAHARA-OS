import type { Metadata } from "next";
import { getLivePricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, FestivalSection, QuoteSection, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, StickyWhatsApp, type Tile } from "@/components/public/category-landing";
import { inr, liveSmallServices } from "@/lib/marketing-content";

// B2C ad landing page — home cleaning. Prices come from the pricing master (never typed here);
// festival prices show only while a festival window is running (FestivalSection).
// Ad-traffic duplicate of /home-deep-cleaning-pune, so it is kept out of the index.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home Cleaning in Pune – Deep Cleaning, Kitchen, Bathroom, Sofa & Carpet | Sahara",
  description: "Home deep cleaning, kitchen and bathroom cleaning, sofa and carpet shampooing across Pune & PCMC. Transparent package prices, real available slots, WhatsApp confirmation.",
  alternates: { canonical: `${BASE_URL}/home-deep-cleaning-pune` },
  robots: { index: false, follow: true },
};

const WA = "Hi Sahara, I'd like to book home cleaning. Please share details.";
const FAQS = [
  { q: "How do I book?", a: "Pick your home size and package, choose an available date and time, and confirm. You get a WhatsApp confirmation right away." },
  { q: "Do festival prices apply on every date?", a: "Festival prices apply to service dates inside the festival window shown above; regular prices apply on other dates. Your booking keeps the price you confirmed." },
  { q: "Do you clean 4 BHK and larger homes?", a: "Yes — larger homes are priced after a site inspection." },
  { q: "Which areas do you cover?", a: "Pune and Pimpri-Chinchwad (PCMC). Standard prices apply in our standard serviceable areas; locations outside it may carry additional charges." },
];

const find = (rows: ReturnType<typeof liveSmallServices>, prefix: string) => rows.find((r) => r.name.startsWith(prefix));
const priceLine = (r?: { price: number | null; unit: string; priceNote: string; rule: string }) =>
  !r ? undefined : r.price != null ? `From ${inr(r.price)} ${r.unit}${r.rule ? ` · ${r.rule.split(" · ")[0]}` : ""}` : r.priceNote || "Price on confirmation";

export default async function ResidentialCleaningPage() {
  const [settings, pricing] = await Promise.all([getCompanySettings(), getLivePricing()]);
  const small = liveSmallServices(pricing.items);
  const tiles: Tile[] = [
    { title: "Home Deep Cleaning", text: "Full-home deep cleaning by a trained in-house team — Premium and Platinum packages for 1, 2 and 3 BHK.", href: "#quote", cta: "Choose package" },
    { title: "Kitchen Deep Cleaning", text: "Cabinets, platform, tiles, sink and appliance exteriors cleaned thoroughly.", note: priceLine(find(small, "Kitchen Deep Cleaning (Without")), href: "/booking?service=home#book", cta: "Book kitchen cleaning" },
    { title: "Bathroom Deep Cleaning", text: "Tiles, fittings, glass and floors scrubbed and descaled.", note: priceLine(find(small, "Bathroom Deep Cleaning")), href: "/booking?service=home#book", cta: "Book bathroom cleaning" },
    { title: "Sofa Shampooing", text: "Machine shampooing and extraction for fabric sofas.", note: priceLine(find(small, "Sofa Cleaning")), href: "/booking?service=home#book", cta: "Book sofa cleaning" },
    { title: "Carpet Shampooing", text: "Carpet shampooing and extraction, priced by carpet size.", note: priceLine(find(small, "Carpet Cleaning")), href: "/booking?service=home#book", cta: "Book carpet cleaning" },
  ];
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#quote"
      mobileBar={<CategoryBar waText={WA} cta="Book Now" href="#quote" />}
    >
      <CategoryHero
        image="/marketing/hero-home.webp"
        alt="Sahara cleaning team deep cleaning a Pune home"
        title="Home Cleaning in Pune"
        subtitle="Deep cleaning, kitchen, bathroom, sofa and carpet — transparent prices and real available slots."
        points={["100% in-house staff in Sahara uniforms with ID badges", "Pay advance or pay after service", "WhatsApp confirmation for every booking", "Pune & PCMC"]}
        waText={WA}
        cta="Book Online"
        ctaHref="#quote"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <FestivalSection bookHref="#quote" />
        <QuoteSection title="Book online" subtitle="Pick a package, an available date and time — we confirm on WhatsApp." campaignName="Residential Cleaning" defaultService="HOME_DEEP_CLEANING" />
        <ServiceTiles heading="Home cleaning services" sub="Prices are live from our price list." tiles={tiles} />
        <AreasBadge />
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
