import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { CONTACT, PAINT_OPTIONS, PAINT_SCOPE } from "@/lib/marketing-content";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, Panel, BulletList, StickyWhatsApp } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";

// B2C + B2B ad landing page — painting & finishing. Painting rates are never public
// (owner rule): the form books a FREE site inspection and the quote is measurement-based.
// Ad-traffic duplicate of /interior-painting-pune → noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painting Services in Pune – Interior, Exterior, Waterproofing, Epoxy | Sahara",
  description: "Interior and exterior painting, waterproofing and epoxy flooring across Pune & PCMC. Book a free site inspection and get a measurement-based quote.",
  alternates: { canonical: `${BASE_URL}/interior-painting-pune` },
  robots: { index: false, follow: true },
};

const WA = "Hi Sahara, I'd like to book a free site inspection for painting.";
const FAQS = [
  { q: "Is the site inspection free?", a: "Yes. We visit, inspect the surfaces, measure the area and share a written quote." },
  { q: "How is painting priced?", a: "Painting is quoted after measurement, based on the paint you choose, surface condition and number of coats." },
  { q: "Do you do waterproofing and epoxy flooring?", a: "Yes. Waterproofing and epoxy flooring are scoped at the site inspection, and the quote is shared after it." },
  { q: "Which paints do you use?", a: "Asian Paints range — from distemper and tractor emulsion to Premium Emulsion, Royale and texture finishes." },
];
const TYPES = ["Interior Painting", "Exterior Painting", "Waterproofing", "Epoxy Flooring", "Not sure — need advice"];

export default async function PaintingServicesPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} cta="Free Inspection" />}
    >
      <CategoryHero
        image="/marketing/service-painting.webp"
        alt="Sahara painting team painting an interior wall in Pune"
        title="Painting Services in Pune"
        subtitle="Interior and exterior painting, waterproofing and epoxy flooring for homes and commercial spaces."
        points={["Free site inspection and measurement", "Asian Paints range", "Surface preparation, putty and primer where needed", "Homes, offices, shops and societies"]}
        waText={WA}
        badge="Homes & Commercial"
        cta="Book Free Inspection"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <CategoryLeadForm
          service="PAINTING"
          serviceLabel="Painting Services"
          campaignName="Painting Services Landing"
          waNumber={CONTACT.whatsapp}
          title="Book a free site inspection"
          cta="Book Free Site Inspection"
          typeLabel="Service needed"
          typeOptions={TYPES}
          areaLabel="Approx. area in sq. ft. (optional)"
          showDate
          schedule
        />
        <ServiceTiles
          heading="What we paint and protect"
          tiles={[
            { title: "Interior Painting", text: "Walls and ceilings with proper preparation, putty, primer and finishing coats." },
            { title: "Exterior Painting", text: "Weather-resistant exterior finishes for homes, buildings and societies." },
            { title: "Waterproofing", text: "Terrace, bathroom and wall seepage treatment scoped at the inspection." },
            { title: "Epoxy Flooring", text: "Durable epoxy floor finishes for parking, workshops and commercial areas." },
          ]}
        />
        <Panel title="Paint options"><BulletList items={PAINT_OPTIONS} /></Panel>
        <Panel title="What a painting job includes"><BulletList items={PAINT_SCOPE} /></Panel>
        <AreasBadge />
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
