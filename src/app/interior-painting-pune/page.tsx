import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, QuoteSection, Faqs, Terms, OtherServices, ScopeLists, SOCIAL, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { Accordion, CampaignBar, CampaignFooter, CampaignHero, CampaignStyles } from "@/components/public/campaign-kit";
import { PAINT_OPTIONS, PAINT_SCOPE } from "@/lib/marketing-content";

// Reads company settings from the DB, which is not available at image build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interior Painting in Pune – Asian Paints Range, Free Site Inspection & Quote | Sahara",
  description: "Interior painting across Pune & PCMC with Asian Paints options — Oil Bound Distemper, Tractor Emulsion, Premium Emulsion, Royale, Royale Lustre and texture painting. Free site inspection and measurement-based quote.",
  alternates: { canonical: `${BASE_URL}/interior-painting-pune` },
  openGraph: { title: "Interior Painting in Pune — Sahara Cleaning Services", description: "Free site inspection and measurement-based painting quote.", url: `${BASE_URL}/interior-painting-pune`, images: [`${BASE_URL}/marketing/hero-painting.webp`], type: "website" },
};

const WA = "Hi Sahara, I'd like a quote for interior painting.";
const FAQS = [
  { q: "How is painting priced?", a: "Painting is quoted after a free site inspection and measurement, based on the area, surface condition and the paint you choose." },
  { q: "Is the site inspection free?", a: "Yes — the interior painting site inspection is free. Nothing is charged until you approve the written quote." },
  { q: "How many coats do you apply?", a: "The number of coats depends on the site condition and the selected finish; it is confirmed in your quote." },
  { q: "Do you protect furniture and floors?", a: "Yes — basic protection of furniture and flooring is part of the work, followed by final cleaning." },
  { q: "Can I choose the paint type?", a: "Yes. Choose from the Asian Paints options listed on this page; our team can advise on the right finish for each room." },
];

export default async function InteriorPaintingPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}
      bookHref="#quote"
      footer={<CampaignFooter logoUrl={settings.logoUrl} waText={WA} social={SOCIAL} />}
      mobileBar={<CampaignBar label="Interior Painting · Asian Paints" priceNote="Quote after free site inspection" cta="Book Free Site Inspection →" />}
    >
      <CampaignStyles />
      <CampaignHero
        image="/marketing/hero-painting.webp"
        alt="Sahara painter rolling fresh paint on a living-room wall in Pune"
        title="Interior Painting in Pune"
        subtitle="Neat preparation, the right paint for every room and a clean professional finish."
        service="PAINTING"
        serviceLabel="Interior Painting"
        campaignName="Interior Painting Pune"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <QuoteSection title="Get your painting quote" subtitle="Tell us your home size and rooms — we'll schedule a free site inspection and measurement." campaignName="Interior Painting Pune" defaultService="PAINTING" />
        <section>
          <h2 className="text-2xl font-bold">Paint options</h2>
          <p className="text-sm text-[#0a2540]/70">Free site inspection and measurement — price shared after measurement.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PAINT_OPTIONS.map((p) => <span key={p} className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">{p}</span>)}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold">Painting process</h2>
          <ScopeLists included={PAINT_SCOPE} equipment={null} />
        </section>
        <Accordion title="Frequently asked questions"><Faqs faqs={FAQS} /></Accordion>
        <Terms />
        <OtherServices current="/interior-painting-pune" />
      </main>
    </LandingShell>
  );
}
