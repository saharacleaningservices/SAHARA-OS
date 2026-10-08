import type { Metadata } from "next";
import { getLivePricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, FestivalSection, PackageGrid, RoomScope, QuoteSection, Faqs, Terms, OtherServices, SOCIAL, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { Accordion, CampaignBar, CampaignFooter, CampaignHero, CampaignStyles } from "@/components/public/campaign-kit";
import { livePkgs, liveSmallServices, liveCombos, inr } from "@/lib/marketing-content";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

const fromPrice = (pk: { price: number }[]) => Math.min(...pk.map((p) => p.price ?? Infinity));

export async function generateMetadata(): Promise<Metadata> {
  const { items } = await getLivePricing();
  const HOME_FROM_PRICE = fromPrice(livePkgs(items, "PREMIUM"));
  const PLATINUM_FROM_PRICE = fromPrice(livePkgs(items, "PLATINUM"));
  return {
  title: `Home Deep Cleaning in Pune – 1 BHK from ${inr(HOME_FROM_PRICE)} | Sahara Cleaning Services`,
  description: `Professional home deep cleaning across Pune & PCMC with transparent package prices: Premium 1 BHK ${inr(HOME_FROM_PRICE)}, Platinum with wall wet cleaning from ${inr(PLATINUM_FROM_PRICE)}. Sofa, bathroom, kitchen & mattress cleaning too.`,
  alternates: { canonical: `${BASE_URL}/home-deep-cleaning-pune` },
  openGraph: { title: "Home Deep Cleaning in Pune — Transparent Package Prices", description: `Premium from ${inr(HOME_FROM_PRICE)} · Platinum from ${inr(PLATINUM_FROM_PRICE)} · Since 2012.`, url: `${BASE_URL}/home-deep-cleaning-pune`, images: [`${BASE_URL}/marketing/hero-home.webp`], type: "website" },
  };
}

const WA = "Hi Sahara, I'd like to book home deep cleaning. Please share details.";
const FAQS = [
  { q: "How long does a home deep clean take?", a: "Usually 7–8 hours, depending on home size and condition." },
  { q: "What is the difference between Premium and Platinum?", a: "Platinum includes the full Premium scope plus wall wet cleaning and ceiling dry dusting." },
  { q: "Do I need to provide cleaning materials?", a: "No. Our team brings professional equipment and cleaning chemicals. Please keep water and electricity available." },
  { q: "Are there minimum quantities for small services?", a: "Yes — sofa cleaning needs a minimum of 5 seats, bathroom cleaning a minimum of 2 bathrooms and mattress cleaning a minimum of 2 mattresses." },
  { q: "Is chimney cleaning included in kitchen cleaning?", a: "No. Kitchen Deep Cleaning (Without Chimney) excludes chimney cleaning; it can be quoted separately." },
];

export default async function HomeDeepCleaningPage() {
  const [settings, pricing] = await Promise.all([getCompanySettings(), getLivePricing()]);
  const PREMIUM = livePkgs(pricing.items, "PREMIUM");
  const PLATINUM = livePkgs(pricing.items, "PLATINUM");
  const SMALL_SERVICES = liveSmallServices(pricing.items);
  const COMBOS = liveCombos(pricing.items);
  // Sticky-bar default: the most-booked package (genuine MRP shown only if the owner set one).
  const popular = PREMIUM.find((p) => p.bhk === "2 BHK") ?? PREMIUM[0];
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd({ makesOffer: [...PREMIUM, ...PLATINUM].map((p, i) => ({ "@type": "Offer", name: `${p.bhk} ${i < 4 ? "Premium" : "Platinum"} Home Deep Cleaning`, price: p.price, priceCurrency: "INR" })) }), faqJsonLd(FAQS)]}
      bookHref="#quote"
      footer={<CampaignFooter logoUrl={settings.logoUrl} waText={WA} social={SOCIAL} />}
      mobileBar={popular ? <CampaignBar label={`${popular.bhk} Premium · Home Deep Cleaning`} price={popular.price} mrp={popular.mrp} /> : undefined}
    >
      <CampaignStyles />
      <CampaignHero
        image="/marketing/hero-home.webp"
        alt="Sahara team vacuuming a carpet and wiping surfaces during home deep cleaning in Pune"
        title="Home Deep Cleaning in Pune"
        subtitle="Premium & Platinum packages with transparent prices — pick a live slot, pay after service."
        service="HOME_DEEP_CLEANING"
        serviceLabel="Home Deep Cleaning"
        campaignName="Home Deep Cleaning Pune"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <QuoteSection title="Book home deep cleaning" subtitle="Pick your home size, date and time — we confirm on WhatsApp." campaignName="Home Deep Cleaning Pune" defaultService="HOME_DEEP_CLEANING" />
        <FestivalSection />
        <section>
          <h2 className="text-xl font-bold sm:text-2xl">Premium home deep cleaning</h2>
          <p className="text-sm text-[#0a2540]/70">Complete top-to-bottom cleaning of your home. Estimated 7–8 hours.</p>
          <PackageGrid items={PREMIUM} tier="Premium" />
          <div className="mt-3"><Accordion title="View Full Cleaning Scope — Premium"><RoomScope tier="Premium" compact /></Accordion></div>
        </section>
        <section>
          <h2 className="text-xl font-bold sm:text-2xl">Platinum home deep cleaning</h2>
          <p className="mt-1 inline-block rounded-lg bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">⭐ WALL WET CLEANING &amp; CEILING DRY DUSTING INCLUDED</p>
          <PackageGrid items={PLATINUM} accent tier="Platinum" />
          <div className="mt-3"><Accordion title="View Full Cleaning Scope — Platinum"><RoomScope tier="Platinum" compact /></Accordion></div>
        </section>
        <Accordion title="Individual cleaning services & combo packages">
          <div className="grid gap-3 sm:grid-cols-2">
            {SMALL_SERVICES.map((s) => (
              <div key={s.name} className="rounded-xl bg-[#0a2540]/[0.03] p-3">
                <h3 className="font-bold">{s.name}</h3>
                <p className="text-lg font-extrabold text-primary">{s.price == null ? <span className="text-sm font-semibold">{s.priceNote}</span> : <>{inr(s.price)} <span className="text-sm font-medium text-[#0a2540]/70">{s.unit}</span></>}</p>
                <p className="text-xs font-bold uppercase text-amber-700">{s.rule}</p>
              </div>
            ))}
            {COMBOS.map((c) => (
              <div key={c.name} className="rounded-xl bg-[#0a2540]/[0.03] p-3">
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-lg font-extrabold text-primary">{inr(c.price)}</p>
                {c.note && <p className="text-xs font-semibold text-amber-700">{c.note}</p>}
              </div>
            ))}
          </div>
        </Accordion>
        <Accordion title="Frequently asked questions"><Faqs faqs={FAQS} /></Accordion>
        <Terms />
        <OtherServices current="/home-deep-cleaning-pune" />
      </main>
    </LandingShell>
  );
}
