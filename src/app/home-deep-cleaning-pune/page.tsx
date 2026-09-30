import type { Metadata } from "next";
import { HOME_FROM_PRICE, PLATINUM_FROM_PRICE } from "@/lib/pricing-master";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, PackageGrid, ScopeLists, QuoteSection, HowItWorks, Areas, Faqs, Terms, FinalCta, OtherServices, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { PREMIUM, PLATINUM, PREMIUM_SCOPE, PREMIUM_EXCLUDED, PLATINUM_SCOPE, PLATINUM_EXCLUDED, SMALL_SERVICES, COMBOS, inr } from "@/lib/marketing-content";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Home Deep Cleaning in Pune – 1 BHK from ${inr(HOME_FROM_PRICE)} | Sahara Cleaning Services`,
  description: `Professional home deep cleaning across Pune & PCMC with transparent package prices: Premium 1 BHK ${inr(HOME_FROM_PRICE)}, Platinum with wall wet cleaning from ${inr(PLATINUM_FROM_PRICE)}. Sofa, bathroom, kitchen & mattress cleaning too.`,
  alternates: { canonical: `${BASE_URL}/home-deep-cleaning-pune` },
  openGraph: { title: "Home Deep Cleaning in Pune — Transparent Package Prices", description: `Premium from ${inr(HOME_FROM_PRICE)} · Platinum from ${inr(PLATINUM_FROM_PRICE)} · Since 2012.`, url: `${BASE_URL}/home-deep-cleaning-pune`, images: [`${BASE_URL}/marketing/hero-home.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like to book home deep cleaning. Please share details.";
const FAQS = [
  { q: "How long does a home deep clean take?", a: "Usually 7–8 hours, depending on home size and condition." },
  { q: "What is the difference between Premium and Platinum?", a: "Platinum includes the full Premium scope plus wall wet cleaning and ceiling dry dusting." },
  { q: "Do I need to provide cleaning materials?", a: "No. Our team brings professional equipment and cleaning chemicals. Please keep water and electricity available." },
  { q: "Are there minimum quantities for small services?", a: "Yes — sofa cleaning needs a minimum of 5 seats, bathroom cleaning a minimum of 2 bathrooms and mattress cleaning a minimum of 2 mattresses." },
  { q: "Is chimney cleaning included in kitchen cleaning?", a: "No. Kitchen Deep Cleaning (Without Chimney) excludes chimney cleaning; it can be quoted separately." },
];

export default async function HomeDeepCleaningPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd({ makesOffer: [...PREMIUM, ...PLATINUM].map((p, i) => ({ "@type": "Offer", name: `${p.bhk} ${i < 4 ? "Premium" : "Platinum"} Home Deep Cleaning`, price: p.price, priceCurrency: "INR" })) }), faqJsonLd(FAQS)]}>
      <Hero
        image="/marketing/hero-home.webp"
        alt="Sahara team vacuuming a carpet and wiping surfaces during home deep cleaning in Pune"
        eyebrow="Navratri • Dussehra • Diwali · Festival cleaning"
        title="Home Deep Cleaning in Pune"
        subtitle="Premium & Platinum packages with transparent prices, done by a trained Sahara team."
        primaryLabel="View Packages / Book Now"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section>
          <h2 className="text-2xl font-bold">Premium home deep cleaning</h2>
          <p className="text-sm text-[#0a2540]/70">Complete top-to-bottom cleaning of your home. Estimated 7–8 hours.</p>
          <PackageGrid items={PREMIUM} />
          <ScopeLists included={PREMIUM_SCOPE} excluded={PREMIUM_EXCLUDED} />
        </section>
        <section>
          <h2 className="text-2xl font-bold">Platinum home deep cleaning</h2>
          <p className="mt-1 inline-block rounded-lg bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">⭐ WALL WET CLEANING &amp; CEILING DRY DUSTING INCLUDED</p>
          <p className="mt-1 text-sm text-[#0a2540]/70">The same complete scope as Premium, with wall wet cleaning instead of wall dry dusting.</p>
          <PackageGrid items={PLATINUM} accent />
          <ScopeLists included={PLATINUM_SCOPE} excluded={PLATINUM_EXCLUDED} />
        </section>
        <section>
          <h2 className="text-2xl font-bold">Individual cleaning services</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SMALL_SERVICES.map((s) => (
              <div key={s.name} className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="font-bold">{s.name}</h3>
                <p className="text-2xl font-extrabold text-primary">{s.price == null ? <span className="text-sm font-semibold">{s.priceNote}</span> : <>{inr(s.price)} <span className="text-sm font-medium text-[#0a2540]/70">{s.unit}</span></>}</p>
                <p className="text-xs font-bold uppercase text-amber-700">{s.rule}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold">Combo packages</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COMBOS.map((c) => (
              <div key={c.name} className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-2xl font-extrabold text-primary">{inr(c.price)}</p>
                {c.note && <p className="text-xs font-semibold text-amber-700">{c.note}</p>}
              </div>
            ))}
          </div>
        </section>
        <QuoteSection title="Book home deep cleaning" subtitle="Tell us your home size and preferred date — we’ll confirm the price and slot." campaignName="Home Deep Cleaning Pune" defaultService="HOME_DEEP_CLEANING" />
        <HowItWorks />
        <Areas />
        <Faqs faqs={FAQS} />
        <Terms />
        <OtherServices current="/home-deep-cleaning-pune" />
        <FinalCta title="Get your home deep cleaned by Sahara" waText={WA} />
      </main>
    </LandingShell>
  );
}
