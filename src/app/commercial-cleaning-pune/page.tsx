import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, ScopeLists, QuoteSection, HowItWorks, Areas, Faqs, Terms, FinalCta, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Office & Commercial Cleaning in Pune – Site Visit & Quote | Sahara Cleaning Services",
  description: "Office deep cleaning and commercial cleaning across Pune & PCMC: workstations, cabins, pantry, washrooms, glass and floor scrubbing. Free site visit and quote from Sahara Cleaning Services.",
  alternates: { canonical: `${BASE_URL}/commercial-cleaning-pune` },
  openGraph: { title: "Office & Commercial Cleaning in Pune — Sahara Cleaning Services", description: "Site visit and quote for offices, workspaces and commercial premises.", url: `${BASE_URL}/commercial-cleaning-pune`, images: [`${BASE_URL}/marketing/hero-commercial.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like a site visit and quote for office/commercial cleaning.";
const OFFICE_SCOPE = [
  "Workstations, tables and chairs",
  "Glass partitions and doors",
  "Floors — scrubbing and mopping (machine cleaning where required)",
  "Pantry and washrooms",
  "Common areas, dusting and cobweb removal",
];
const VILLA_SCOPE = ["Rooms and living areas", "Kitchen and bathrooms", "Windows, glass and balconies", "Furniture exterior, doors, fans and lights", "Detailed dusting and cobweb removal"];
const FAQS = [
  { q: "How is commercial cleaning priced?", a: "Every site is different, so we visit, understand the area and scope, and share a clear quote before work starts." },
  { q: "Can you clean outside office hours?", a: "Share your preferred timing when you request the site visit and we'll plan the schedule with you." },
  { q: "Do you bring equipment and chemicals?", a: "Yes — commercial vacuum cleaners, scrubbing machines where required, microfiber system and appropriate cleaning chemicals." },
  { q: "Do you also clean villas and bungalows?", a: "Yes. Villa deep cleaning is also quoted after a site visit." },
];

export default async function CommercialCleaningPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}>
      <Hero
        image="/marketing/hero-commercial.webp"
        alt="Sahara cleaning team scrubbing floors and cleaning glass partitions in a Pune office"
        eyebrow="Offices · Workspaces · Commercial premises"
        title="Professional Office & Commercial Cleaning in Pune"
        subtitle="Trained team, professional equipment and flexible scheduling — quoted after a site visit."
        primaryLabel="Get Site Visit & Quote"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <section>
          <h2 className="text-2xl font-bold">Office deep cleaning</h2>
          <p className="text-sm text-[#0a2540]/70">Inspection on call — price shared after the site visit.</p>
          <ScopeLists included={OFFICE_SCOPE} />
        </section>
        <section>
          <h2 className="text-2xl font-bold">Villa deep cleaning</h2>
          <p className="text-sm text-[#0a2540]/70">Site visit required — price shared after inspection.</p>
          <ScopeLists included={VILLA_SCOPE} />
        </section>
        <QuoteSection title="Request a site visit" subtitle="Tell us your location and the size of the space — we'll schedule a visit and share a quote." campaignName="Commercial Cleaning Pune" defaultService="COMMERCIAL_CLEANING" />
        <HowItWorks />
        <Areas />
        <Faqs faqs={FAQS} />
        <Terms />
        <FinalCta title="Get a cleaner, healthier workplace" waText={WA} />
      </main>
    </LandingShell>
  );
}
