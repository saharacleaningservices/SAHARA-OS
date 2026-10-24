import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, QuoteSection, Faqs, Terms, OtherServices, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { Accordion, CampaignBar, CampaignFooter, CampaignHero, CampaignStyles } from "@/components/public/campaign-kit";
import { PEST_SERVICES } from "@/lib/marketing-content";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pest Control in Pune – Cockroach, Termite, Bed Bug, Ant | Sahara Cleaning Services",
  description: "Professional pest control across Pune & PCMC for cockroaches, termites, bed bugs and ants. Inspection-based treatment plan and quote from Sahara Cleaning Services.",
  alternates: { canonical: `${BASE_URL}/pest-control-pune` },
  openGraph: { title: "Pest Control in Pune — Sahara Cleaning Services", description: "Cockroach, termite, bed bug and ant control. Book an inspection.", url: `${BASE_URL}/pest-control-pune`, images: [`${BASE_URL}/marketing/service-pest-control.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like to book a pest control inspection.";
const FAQS = [
  { q: "How is pest control priced?", a: "Price depends on the pest, the level of infestation and the property. We inspect first and then share the treatment plan and quote." },
  { q: "Is there a warranty?", a: "Any warranty depends on the treatment recommended after inspection and is confirmed in your quote." },
  { q: "Will one treatment remove all pests?", a: "Results depend on infestation level and site conditions; a follow-up visit may be recommended." },
  { q: "Should I empty the kitchen before cockroach treatment?", a: "Our team will share simple preparation steps when your inspection is booked." },
];

export default async function PestControlPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#quote"
      footer={<CampaignFooter logoUrl={settings.logoUrl} waText={WA} />}
      mobileBar={<CampaignBar label="Pest Control · inspection-based quote" priceNote="Price after inspection" cta="Book Inspection →" />}
    >
      <CampaignStyles />
      <CampaignHero
        image="/marketing/service-pest-control.webp"
        alt="Sahara pest control technician treating kitchen skirting in a Pune apartment"
        title="Pest Control in Pune"
        subtitle="Inspection first, then a targeted treatment plan by a trained team."
        service="PEST_CONTROL"
        serviceLabel="Pest Control"
        campaignName="Pest Control Pune"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <QuoteSection title="Book a pest inspection" subtitle="Tell us the pest problem and your location — we'll schedule an inspection." campaignName="Pest Control Pune" defaultService="PEST_CONTROL" />
        <section>
          <h2 className="text-2xl font-bold">Pest control services</h2>
          <p className="text-sm text-[#0a2540]/70">Inspection / site assessment required — quote shared after inspection.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PEST_SERVICES.map((p) => (
              <div key={p.name} className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-[#0a2540]/75">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <Accordion title="Frequently asked questions"><Faqs faqs={FAQS} /></Accordion>
        <Terms />
        <OtherServices current="/pest-control-pune" />
      </main>
    </LandingShell>
  );
}
