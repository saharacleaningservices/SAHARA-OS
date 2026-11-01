import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { CONTACT } from "@/lib/marketing-content";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, StickyWhatsApp, Panel, BulletList } from "@/components/public/category-landing";
import { CategoryLeadForm } from "@/components/public/category-lead-form";
import { SeoCtaTracker } from "@/components/public/seo-cta-tracker";
import { VERTICALS, ZONES, branchForLocality, categoryBySlug, localityBySlug, seoPagePath, whatsappTextFor } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra, seoBreadcrumb, seoServiceJsonLd } from "@/lib/seo-graph";
import { h1, localIntro, nearbyLocalities, pageFaqs, seoDescription, seoTitle, siblingServices } from "@/lib/seo-copy";

// Programmatic local-SEO landing page: /services/<category>/<location>  (11 services × 39 localities).
// Built on first request, then cached for a day (ISR) — fast TTFB for Google Ads Quality Score without a build-time DB.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ category: string; location: string }> };

const HERO: Record<string, string> = {
  residential: "/marketing/hero-home.webp",
  commercial: "/marketing/hero-commercial-v2.webp",
  "post-interior": "/marketing/hero-commercial-v2.webp",
  pest: "/marketing/hero-pest.webp",
  painting: "/marketing/hero-painting.webp",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, location } = await params;
  const c = categoryBySlug(category);
  const l = localityBySlug(location);
  if (!c || !l) return {};
  const url = `${BASE_URL}${seoPagePath(c.slug, l.slug)}`;
  const title = seoTitle(c, l);
  const description = seoDescription(c, l);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: { type: "website", url, title, description, siteName: "Sahara Cleaning Services", locale: "en_IN", images: [{ url: `${BASE_URL}${HERO[c.vertical]}` }] },
  };
}

export default async function SeoLocationPage({ params }: Props) {
  const { category, location } = await params;
  const c = categoryBySlug(category);
  const l = localityBySlug(location);
  if (!c || !l) notFound();
  const settings = await getCompanySettings();
  const branch = branchForLocality(l);
  const path = seoPagePath(c.slug, l.slug);
  const WA = whatsappTextFor(c, l);
  const faqs = pageFaqs(c, l);
  const vertical = VERTICALS[c.vertical];
  const near = nearbyLocalities(l);
  const siblings = siblingServices(l).filter((s) => s.slug !== c.slug);
  const isB2B = c.vertical === "commercial" || c.vertical === "post-interior";

  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      waNumber={branch.whatsapp}
      jsonLd={[
        businessJsonLd(magarpattaBranchExtra()),
        ...branchGraph(),
        seoServiceJsonLd(c, l, path),
        seoBreadcrumb(c, l, path),
        faqJsonLd(faqs),
      ]}
      bookHref="#enquiry"
      mobileBar={<CategoryBar waText={WA} waNumber={branch.whatsapp} cta="Get Quote" />}
    >
      <SeoCtaTracker service={c.slug} area={l.name} branch={branch.key} vertical={c.vertical} />
      <CategoryHero
        image={HERO[c.vertical]}
        alt={`Sahara crew providing ${c.keyword} in ${l.name}, Pune`}
        title={h1(c, l)}
        subtitle={`For ${l.premises} in ${l.name} (${l.pins[0]}).`}
        points={["Trained in-house staff in uniform", "Written quote or scope before work", `Served from our ${branch.locality} branch`, "Pune & PCMC since 2012 · GST invoice"]}
        waText={WA}
        waNumber={branch.whatsapp}
        badge={ZONES[l.zone].label}
        cta="Get Free Quote"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">{c.name} for {l.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#0a2540]/80">{localIntro(c, l)}</p>
          <p className="mt-2 text-sm text-[#0a2540]/80">Typically booked by {c.audience}.</p>
        </section>

        <CategoryLeadForm
          service={vertical.crm}
          serviceLabel={`${c.name} in ${l.name}`}
          campaignName={`SEO page: ${c.slug} / ${l.slug} (${branch.key} branch, ${branch.sourceLine})`}
          waNumber={branch.whatsapp}
          title={`Get a quote for ${c.keyword} in ${l.name}`}
          cta="Request Free Quote"
          typeLabel={c.typeLabel}
          typeOptions={c.typeOptions}
          showCompany={isB2B}
          showDate
          schedule
          defaultLocality={l.name}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={`What ${c.short.toLowerCase()} includes`}><BulletList items={c.includes} /></Panel>
          <Panel title={`Why ${l.name} customers choose Sahara`}>
            <BulletList items={[
              "Serving Pune since 2012 with trained, uniformed in-house staff",
              "Machines, tools and chemicals brought by the crew",
              "Written quote and agreed scope before work starts",
              `Dispatch from the ${branch.locality} branch — ${ZONES[l.zone].label}`,
              "GST invoice and UPI / bank payment options",
            ]} />
          </Panel>
        </div>

        {isB2B && (
          <section className="rounded-2xl bg-[#0a2540] p-5 text-white shadow-sm">
            <h2 className="text-lg font-bold">{c.vertical === "post-interior" ? "Architect or interior designer?" : "Managing a corporate site?"}</h2>
            <p className="mt-1 text-sm text-white/80">{c.vertical === "post-interior" ? "Post-interior cleaning with fixed handover schedules for design studios and contractors." : "Housekeeping, security and facility management contracts with monthly GST invoicing."}</p>
            <Link href={c.vertical === "post-interior" ? "/b2b/architects" : "/b2b/corporate-facility"} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-amber-400 px-5 text-sm font-extrabold text-[#0a2540]">Open the {c.vertical === "post-interior" ? "architect" : "corporate"} desk</Link>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">More services in {l.name}</h2>
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            {siblings.map((s) => <Link key={s.slug} href={s.href} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{s.name}</Link>)}
          </p>
        </section>

        {near.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">{c.short} near {l.name}</h2>
            <p className="mt-2 flex flex-wrap gap-2 text-sm">
              {near.map((n) => <Link key={n.slug} href={seoPagePath(c.slug, n.slug)} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{c.short} in {n.name}</Link>)}
              <Link href={`/services/${c.slug}`} className="rounded-full border px-3 py-1 font-medium">All Pune areas</Link>
            </p>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 text-sm shadow-sm">
          <h2 className="text-lg font-bold">Contact the {branch.locality} branch</h2>
          <p className="mt-1 text-[#0a2540]/80">Call <a className="font-semibold text-primary" href={`tel:+91${branch.phone}`}>{branch.phone}</a> or WhatsApp <a className="font-semibold text-success" href={`https://wa.me/91${branch.whatsapp}`}>{branch.whatsapp}</a>. Head office: {CONTACT.address}.</p>
        </section>

        <AreasBadge />
        <Faqs faqs={faqs} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} waNumber={branch.whatsapp} />
    </LandingShell>
  );
}

