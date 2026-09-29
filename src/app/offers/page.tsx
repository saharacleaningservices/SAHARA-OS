import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, PackageGrid, QuoteSection, HowItWorks, Areas, Faqs, Terms, FinalCta, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { PREMIUM, PLATINUM, SMALL_SERVICES, inr } from "@/lib/marketing-content";

// Festival campaign hub (Navratri · Dussehra · Diwali) — the WhatsApp campaign
// lands here and customers pick a service page.

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festival Home & Office Cleaning in Pune – Navratri, Dussehra, Diwali | Sahara",
  description: "Get your home and workplace festival-ready with Sahara Cleaning Services, Pune. Home deep cleaning from ₹3,999, office cleaning, pest control and interior painting. Since 2012.",
  alternates: { canonical: `${BASE_URL}/offers` },
  openGraph: { title: "Get Your Home & Workplace Festival-Ready — Sahara Cleaning Services", description: "Navratri • Dussehra • Diwali. Transparent home deep cleaning prices from ₹3,999.", url: `${BASE_URL}/offers`, images: [`${BASE_URL}/marketing/hero-home.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like to book festival cleaning. Please share details.";
const SERVICES = [
  { href: "/home-deep-cleaning-pune", img: "/marketing/hero-home.webp", title: "Home Deep Cleaning", text: `Premium & Platinum packages from ${inr(3999)}.`, cta: "View Packages" },
  { href: "/commercial-cleaning-pune", img: "/marketing/hero-commercial.webp", title: "Office & Commercial Cleaning", text: "Offices, workspaces and commercial premises — site visit and quote.", cta: "Get Quote" },
  { href: "/pest-control-pune", img: "/marketing/hero-pest.webp", title: "Pest Control", text: "Cockroach, termite, bed bug and ant control after inspection.", cta: "Book Inspection" },
  { href: "/interior-painting-pune", img: "/marketing/hero-painting.webp", title: "Interior Painting", text: "Asian Paints range — site visit and measurement based quote.", cta: "Get Painting Quote" },
];
const FAQS = [
  { q: "Why book festival cleaning early?", a: "Navratri, Dussehra and Diwali are the busiest cleaning weeks of the year. Booking early helps you get your preferred date." },
  { q: "Will the prices change during the festival season?", a: "The prices shown are our current package prices. Festival-season demand can lead to price revisions later in the season, so booking early is recommended." },
  { q: "What is the difference between Premium and Platinum?", a: "Platinum includes everything in Premium plus wall wet cleaning and ceiling dry dusting." },
  { q: "Do you clean offices and shops too?", a: "Yes — offices, workspaces and commercial premises. We visit the site and share a quote." },
  { q: "Which areas do you cover?", a: "East Pune — Hadapsar, Magarpatta, Kharadi, Viman Nagar, Wagholi, NIBM, Kondhwa, Undri and nearby areas." },
];

export default async function FestivalOffersPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}>
      <Hero
        image="/marketing/hero-home.webp"
        alt="Sahara Cleaning Services team deep cleaning a living room in Pune"
        badge="Limited-time festival pricing"
        eyebrow="Navratri • Dussehra • Diwali"
        title="Get Your Home & Workplace Festival-Ready"
        subtitle="Professional cleaning, pest control and interior painting for a cleaner, happier and healthier space."
        primaryLabel="Book Early & Lock Your Current Price"
        note="Festival-season demand can lead to price revisions and limited preferred-date availability. Book early to secure the current listed package price."
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <section>
          <h2 className="text-2xl font-bold">Choose your service</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <Link key={s.href} href={s.href} className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md">
                <div className="relative aspect-[4/3]"><Image src={s.img} alt={s.title} fill sizes="(max-width:640px) 100vw, 25vw" className="object-cover" /></div>
                <div className="p-4">
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-[#0a2540]/70">{s.text}</p>
                  <span className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">{s.cta} →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Home deep cleaning — current package prices</h2>
          <h3 className="mt-3 font-semibold">Premium</h3>
          <PackageGrid items={PREMIUM} />
          <h3 className="mt-6 font-semibold">Platinum <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">⭐ WALL WET CLEANING &amp; CEILING DRY DUSTING INCLUDED</span></h3>
          <PackageGrid items={PLATINUM} accent />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SMALL_SERVICES.map((s) => (
              <div key={s.name} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold">{s.name}</p>
                <p className="text-xl font-extrabold text-primary">{inr(s.price)} <span className="text-xs font-medium text-[#0a2540]/70">{s.unit}</span></p>
                <p className="text-xs font-bold uppercase text-amber-700">{s.rule}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm"><Link href="/home-deep-cleaning-pune" className="font-semibold text-primary underline">See full scope, combos and what&apos;s included →</Link></p>
        </section>

        <QuoteSection title="Book your festival cleaning" subtitle="Share a few details — our team will call you to confirm the price and your preferred date." campaignName="Sahara Festival 2026" />
        <HowItWorks />
        <Areas />
        <Faqs faqs={FAQS} />
        <Terms />
        <FinalCta title="Book early for Navratri, Dussehra & Diwali" waText={WA} />
      </main>
    </LandingShell>
  );
}
