import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { OFFICE_SCOPE } from "@/lib/marketing-content";
import { LandingShell, QuoteSection, Faqs, Terms, OtherServices, ScopeLists, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { Accordion, CampaignBar, CampaignFooter, CampaignHero, CampaignStyles } from "@/components/public/campaign-kit";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Office & Commercial Cleaning in Pune – Site Visit & Quote | Sahara Cleaning Services",
  description: "Office deep cleaning and commercial cleaning across Pune & PCMC: workstations, cabins, pantry, washrooms, glass and floor scrubbing. Free site visit and quote from Sahara Cleaning Services.",
  alternates: { canonical: `${BASE_URL}/commercial-cleaning-pune` },
  openGraph: { title: "Office & Commercial Cleaning in Pune — Sahara Cleaning Services", description: "Site visit and quote for offices, workspaces and commercial premises.", url: `${BASE_URL}/commercial-cleaning-pune`, images: [`${BASE_URL}/marketing/hero-commercial.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like a site visit and quote for office/commercial cleaning.";
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
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#quote"
      footer={<CampaignFooter logoUrl={settings.logoUrl} waText={WA} />}
      mobileBar={<CampaignBar label="Office & Commercial Cleaning" priceNote="Quote after site visit" cta="Book Site Visit →" />}
    >
      <CampaignStyles />
      <CampaignHero
        image="/marketing/hero-commercial.webp"
        alt="Sahara cleaning team scrubbing floors and cleaning glass partitions in a Pune office"
        title="Office & Commercial Cleaning in Pune"
        subtitle="Trained team, professional equipment and flexible scheduling — quoted after a site visit."
        service="COMMERCIAL_CLEANING"
        serviceLabel="Office & Commercial Cleaning"
        campaignName="Commercial Cleaning Pune"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <QuoteSection title="Request a site visit" subtitle="Tell us your location and the size of the space — we'll schedule a visit and share a quote." campaignName="Commercial Cleaning Pune" defaultService="COMMERCIAL_CLEANING" />
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
        <Accordion title="Frequently asked questions"><Faqs faqs={FAQS} /></Accordion>
        <Terms />
        <OtherServices current="/commercial-cleaning-pune" />
      </main>
    </LandingShell>
  );
}
