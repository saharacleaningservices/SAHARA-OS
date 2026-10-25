import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { CONTACT } from "@/lib/marketing-content";
import { AREA_SERVICES, CLUSTERS, PUNE_AREAS, areaBySlug } from "@/lib/pune-areas";
import { areaServiceJsonLd, breadcrumbJsonLd } from "@/lib/seo-schema";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, ServiceTiles, StickyWhatsApp } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";

// Area landing page: one per Pune sub-market. The high-intent offer (office cleaning, housekeeping / facility-management AMC) is
// the proposal form; every page links to all five service pages. Content is area-specific (premises, FAQ) — facts only, no prices.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = areaBySlug((await params).area);
  if (!area) return {};
  return {
    title: `Cleaning, Pest Control & Housekeeping in ${area.name}, Pune | Sahara`,
    description: `Home deep cleaning, office cleaning, pest control, painting and housekeeping AMC in ${area.name}, Pune — for ${area.premises}. Call 7083347130 or 8956567130.`,
    alternates: { canonical: `${BASE_URL}/pune/${area.slug}` },
  };
}

export default async function AreaPage({ params }: Props) {
  const area = areaBySlug((await params).area);
  if (!area) notFound();
  const settings = await getCompanySettings();
  const cluster = CLUSTERS[area.cluster];
  const WA = `Hi Sahara, I need a quote for a service in ${area.name}, Pune.`;
  const faqs = [
    { q: `Do you provide cleaning services in ${area.name}?`, a: `Yes. Sahara Cleaning Services serves ${area.name} and the rest of Pune and Pimpri-Chinchwad (PCMC), including ${area.premises}.` },
    { q: `Which services are available in ${area.name}?`, a: "Home deep cleaning, commercial and office cleaning, pest control, interior and exterior painting, and facility management with housekeeping AMC." },
    { q: `How do I get a housekeeping AMC or office cleaning quote in ${area.name}?`, a: "Send an enquiry from this page or call 7083347130 / 8956567130. We visit the site, agree the scope and share a written proposal." },
    { q: "How do I book?", a: "Book online at booking.saharacleaningservices.com/booking, or call or WhatsApp us. Every booking request is confirmed by our office." },
  ];
  const others = PUNE_AREAS.filter((a) => a.cluster === area.cluster && a.slug !== area.slug);
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[
        businessJsonLd(),
        ...AREA_SERVICES.map((s) => areaServiceJsonLd(s.name, s.path, area.name)),
        breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Pune areas", path: "/pune" }, { name: area.name, path: `/pune/${area.slug}` }]),
        faqJsonLd(faqs),
      ]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} cta="Get Proposal" />}
    >
      <CategoryHero
        image="/marketing/hero-commercial-v2.webp"
        alt={`Sahara cleaning crew in Royal Blue uniform serving ${area.name}, Pune`}
        title={`Cleaning, Housekeeping & Pest Control in ${area.name}, Pune`}
        subtitle={`Home deep cleaning, office cleaning, pest control, painting and housekeeping AMC for ${area.premises} in ${area.name}.`}
        points={["Trained in-house staff in uniform", "Written quote or proposal before work", `Serving ${cluster.label}`, "Pune & PCMC since 2012"]}
        waText={WA}
        badge={cluster.label}
        cta="Get Proposal"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Services in {area.name}</h2>
          <p className="mt-1 text-sm text-[#0a2540]/75">{area.name} sits in {cluster.label}, where we are mostly asked to look after {cluster.focus}. Choose a service below, or send one enquiry and we will call you back.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {AREA_SERVICES.map((s) => (
              <li key={s.key} className="rounded-xl border p-3">
                <Link href={s.path} className="font-semibold text-primary underline-offset-2 hover:underline">{s.name}</Link>
                <p className="mt-1 text-sm text-[#0a2540]/75">{s.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <CategoryLeadForm
          service="HOUSEKEEPING"
          serviceLabel="Housekeeping AMC / Office cleaning"
          campaignName={`Area page: ${area.name}`}
          waNumber={CONTACT.whatsapp}
          title={`Request an office cleaning or housekeeping AMC proposal in ${area.name}`}
          cta="Request Site Visit & Proposal"
          typeLabel="Facility type"
          typeOptions={["Office / IT park", "Society / residential complex", "Commercial / retail facility", "Industrial / warehouse", "Other"]}
          areaLabel="Area in sq. ft. (optional)"
          showCompany
          showDate
          schedule
        />
        <ServiceTiles
          heading="High-value contracts"
          sub="Pricing for these is quoted after a site visit, in writing."
          tiles={[
            { title: "Office Deep Cleaning", text: "Machine scrubbing, carpet and workstation cleaning, planned around your working hours." },
            { title: "Housekeeping AMC", text: "Shift-wise housekeeping staff with periodic deep cleaning under one annual contract." },
            { title: "Facility Management", text: "Common areas, washrooms, pantries and terraces for societies and commercial complexes." },
            { title: "Housekeeping + Pest Control", text: "Bundle routine housekeeping with scheduled pest control visits." },
          ]}
        />
        {others.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Also serving nearby in {cluster.label}</h2>
            <p className="mt-2 flex flex-wrap gap-2 text-sm">
              {others.map((a) => <Link key={a.slug} href={`/pune/${a.slug}`} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{a.name}</Link>)}
              <Link href="/pune" className="rounded-full border px-3 py-1 font-medium">All Pune areas</Link>
            </p>
          </section>
        )}
        <AreasBadge />
        <Faqs faqs={faqs} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
