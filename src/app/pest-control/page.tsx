import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { CONTACT, PEST_SERVICES } from "@/lib/marketing-content";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, StickyWhatsApp } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";

// Facility-management ad landing page — pest control (homes + societies). Inspection first;
// no price or warranty is promised online. Duplicate of /pest-control-pune → noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pest Control in Pune – Cockroach, Termite, Bed Bug & Society Pest Control | Sahara",
  description: "Cockroach, termite and bed bug control for homes, plus society and facility pest control across Pune & PCMC. Book an inspection and get a treatment plan.",
  alternates: { canonical: `${BASE_URL}/pest-control-pune` },
  robots: { index: false, follow: true },
};

const WA = "Hi Sahara, I'd like to book a pest control inspection.";
const FAQS = [
  { q: "How is pest control priced?", a: "Price depends on the pest, infestation level and property. We inspect first and then share the treatment plan and quote." },
  { q: "Do you handle society and commercial pest control?", a: "Yes. Societies, offices and facilities are inspected and quoted for a one-time treatment or a recurring plan." },
  { q: "Is there a warranty?", a: "Any warranty depends on the treatment recommended after inspection and is confirmed in your quote." },
  { q: "Will one treatment remove all pests?", a: "Results depend on infestation level and site conditions; a follow-up visit may be recommended." },
];
const TYPES = ["Cockroach Control", "Termite Control", "Bed Bug Control", "Ant Control", "Society / Facility Pest Control", "Other / not sure"];

export default async function PestControlLanding() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} cta="Book Inspection" />}
    >
      <CategoryHero
        image="/marketing/hero-pest.webp"
        alt="Sahara pest control technician treating a kitchen in a Pune apartment"
        title="Pest Control in Pune"
        subtitle="Cockroach, termite, bed bug and society pest control — inspection first, then a targeted treatment plan."
        points={["Inspection before every treatment plan", "Trained technicians in Sahara uniforms", "Homes, societies and commercial facilities", "Pune & PCMC"]}
        waText={WA}
        cta="Book Inspection"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <CategoryLeadForm
          service="PEST_CONTROL"
          serviceLabel="Pest Control"
          campaignName="Pest Control Landing"
          waNumber={CONTACT.whatsapp}
          title="Book a pest inspection"
          cta="Book Pest Inspection"
          typeLabel="Pest problem"
          typeOptions={TYPES}
          showCompany
          showDate
          schedule
        />
        <ServiceTiles
          heading="Pest control services"
          sub="Inspection / site assessment required — quote shared after inspection."
          tiles={[
            ...PEST_SERVICES.filter((p) => /cockroach|termite|bed bug/i.test(p.name)).map((p) => ({ title: p.name, text: p.desc })),
            { title: "Society Pest Control", text: "Common areas, basements, drains, garbage zones and clubhouses — inspected and treated on a one-time or recurring plan." },
          ]}
        />
        <AreasBadge />
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
