import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { CONTACT } from "@/lib/marketing-content";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, StickyWhatsApp } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";

// Facility-management ad landing page — corporate housekeeping AMC. The packages are
// described by scope only: contract pricing is quoted after a site visit.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corporate Housekeeping & AMC Services in Pune | Sahara Cleaning Services",
  description: "Housekeeping staff and annual maintenance contracts (AMC) for offices, societies and commercial facilities across Pune & PCMC. Site visit and written proposal.",
  alternates: { canonical: `${BASE_URL}/housekeeping-services` },
  openGraph: { title: "Corporate Housekeeping & AMC in Pune — Sahara Cleaning Services", description: "Housekeeping staff and AMC for offices, societies and commercial facilities. Site visit and written proposal.", url: `${BASE_URL}/housekeeping-services`, images: [`${BASE_URL}/marketing/carousel-team.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like a housekeeping AMC proposal for our facility.";
const FAQS = [
  { q: "What is a housekeeping AMC?", a: "An Annual Maintenance Contract (AMC) is a fixed-term agreement where Sahara provides housekeeping staff and scheduled deep cleaning for your premises, with the scope and visit schedule agreed in writing." },
  { q: "How is an AMC priced?", a: "Pricing depends on area, staff strength, shifts and scope. We visit the site and share a written proposal." },
  { q: "Can you provide on-site housekeeping staff?", a: "Yes — shift-wise housekeeping staff for offices, societies and commercial premises, scoped at the site visit." },
  { q: "Which areas do you serve?", a: "Pune and Pimpri-Chinchwad (PCMC)." },
];
const TYPES = ["Office housekeeping AMC", "Society / residential complex", "Commercial / retail facility", "Industrial / warehouse", "Other"];

export default async function HousekeepingServicesPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} cta="Get Proposal" />}
    >
      <CategoryHero
        image="/marketing/carousel-team.webp"
        alt="Sahara housekeeping team in uniform at a Pune facility"
        title="Corporate Housekeeping & AMC in Pune"
        subtitle="Dependable housekeeping staff and annual maintenance contracts for offices, societies and commercial facilities."
        points={["Uniformed, ID-badged in-house staff", "Scope, schedule and visits agreed in writing", "Housekeeping plus periodic deep cleaning", "Pune & PCMC"]}
        waText={WA}
        badge="Facility Management"
        cta="Get AMC Proposal"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <CategoryLeadForm
          service="HOUSEKEEPING"
          serviceLabel="Housekeeping AMC"
          campaignName="Housekeeping AMC Landing"
          waNumber={CONTACT.whatsapp}
          title="Request a housekeeping AMC proposal"
          cta="Request Site Visit & Proposal"
          typeLabel="Facility type"
          typeOptions={TYPES}
          areaLabel="Area in sq. ft. (optional)"
          showCompany
          showDate
          schedule
        />
        <ServiceTiles
          heading="Housekeeping AMC packages"
          sub="Every package is scoped at a site visit — contract pricing is shared in a written proposal."
          tiles={[
            { title: "Daily Housekeeping", text: "On-site housekeeping staff in fixed shifts for daily upkeep of workspaces, pantries, washrooms and common areas." },
            { title: "Periodic Deep Cleaning AMC", text: "Scheduled machine scrubbing and deep cleaning visits across the year, on a calendar agreed with you." },
            { title: "Society & Facility Maintenance", text: "Lobbies, staircases, terraces, clubhouse and common-area cleaning for residential complexes." },
            { title: "Combined Housekeeping + Pest Control", text: "Bundle routine housekeeping with scheduled pest control visits under one contract." },
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
