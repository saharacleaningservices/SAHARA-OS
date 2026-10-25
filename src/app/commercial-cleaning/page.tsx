import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { CONTACT, OFFICE_SCOPE } from "@/lib/marketing-content";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, Panel, BulletList, StickyWhatsApp } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";

// B2B ad landing page — commercial cleaning. No prices are shown or calculated online:
// every site is quoted after a visit, so the "instant estimate" is an area-based estimate
// REQUEST that creates a CRM lead. Ad-traffic duplicate of /commercial-cleaning-pune → noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commercial & Office Cleaning in Pune – Façade Glass, Post-Construction | Sahara",
  description: "High-rise façade glass cleaning, post-construction cleaning, turnkey deep cleaning and office scrubbing across Pune & PCMC. Share your area in sq. ft. and get an estimate after a site visit.",
  alternates: { canonical: `${BASE_URL}/commercial-cleaning-pune` },
  robots: { index: false, follow: true },
};

const WA = "Hi Sahara, I'd like a site visit and quote for commercial cleaning.";
const FAQS = [
  { q: "How is commercial cleaning priced?", a: "Every site is different. Share the area in sq. ft. and the service you need — we visit, confirm the scope and send a clear written quote before work starts." },
  { q: "Can you clean outside office hours?", a: "Yes. Tell us your preferred timing and we will plan the schedule with you." },
  { q: "Do you handle façade glass at height?", a: "High-rise façade glass cleaning is scoped and quoted after a site visit, including access method and safety requirements." },
  { q: "Do you bring equipment and chemicals?", a: "Yes — scrubbing machines, vacuum cleaners, microfiber system and suitable chemicals." },
];
const TYPES = ["High-Rise Façade Glass Cleaning", "Post-Construction Cleaning", "Turnkey Deep Cleaning", "Office Scrubbing / Routine Cleaning"];

export default async function CommercialCleaningLanding() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} cta="Get Estimate" />}
    >
      <CategoryHero
        image="/marketing/hero-commercial-v2.webp"
        alt="Sahara cleaning team scrubbing floors and cleaning glass in a Pune office"
        title="Commercial & Office Cleaning in Pune"
        subtitle="Façade glass, post-construction, turnkey deep cleaning and office scrubbing — scoped and quoted after a site visit."
        points={["Trained in-house teams in branded uniforms", "Machine scrubbing and professional equipment", "Flexible timing, including outside office hours", "Pune & PCMC"]}
        waText={WA}
        badge="B2B · Corporate"
        cta="Get Area Estimate"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <CategoryLeadForm
          service="COMMERCIAL_CLEANING"
          serviceLabel="Commercial Cleaning"
          campaignName="Commercial Cleaning Landing"
          waNumber={CONTACT.whatsapp}
          title="Corporate inquiry & area estimate request"
          cta="Request Estimate & Site Visit"
          typeLabel="Service needed"
          typeOptions={TYPES}
          areaLabel="Area in sq. ft."
          showCompany
          showDate
          schedule
        />
        <ServiceTiles
          heading="Commercial cleaning services"
          sub="Site visit and written quote for every requirement."
          tiles={[
            { title: "High-Rise Façade Glass Cleaning", text: "Exterior glass and façade cleaning for offices and buildings — access method and safety scoped on site." },
            { title: "Post-Construction Cleaning", text: "Dust, debris residue, paint and cement marks removed so the space is ready to occupy." },
            { title: "Turnkey Deep Cleaning", text: "End-to-end deep cleaning of a whole office, showroom or commercial premises in one engagement." },
            { title: "Office Scrubbing", text: "Machine floor scrubbing, workstation, pantry and washroom cleaning — one-time or recurring." },
          ]}
        />
        <Panel title="What office cleaning covers"><BulletList items={OFFICE_SCOPE} /></Panel>
        <AreasBadge />
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
