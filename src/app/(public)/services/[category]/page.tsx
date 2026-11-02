import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, Terms, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, StickyWhatsApp } from "@/components/public/category-landing";
import { LOCALITIES, SERVICE_CATEGORIES, VERTICALS, categoryBySlug } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { breadcrumbJsonLd } from "@/lib/seo-schema";
import { CATALOG_SERVICES, catalogCategory, catalogServiceBySlug, servicePath, servicesIn, type CatalogService } from "@/config/service-catalog";
import { ServicePricing, WorkGallery, InspectionFlow, ClientMarquee, ZoneAccordion } from "@/components/public/catalog-blocks";
import { LeadButton } from "@/components/public/lead-button";
import { TRUST } from "@/lib/booking-target";

// Rendered per request like every other public page: the Docker build has no database, so nothing that reads
// Company Settings may be prerendered at build time (Coolify build failed on /b2b/architects, 2026-11-01).
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).category;
  const svc = catalogServiceBySlug(slug);
  if (svc) {
    const url = `${BASE_URL}${servicePath(svc.slug)}`;
    const title = `${svc.name} in Pune | ${svc.pricing.mode === "inspection" ? "Free Site Inspection" : "Fixed Rates"} | Sahara`;
    const description = `${svc.intro} Pune & PCMC · in-house trained staff · GST invoice · ${TRUST.rating}★ Google.`.slice(0, 300);
    return { title, description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { type: "website", url, title, description, siteName: "Sahara Cleaning Services", locale: "en_IN", images: [`${BASE_URL}${svc.image}`] } };
  }
  const c = categoryBySlug(slug);
  if (!c) return {};
  const url = `${BASE_URL}/services/${c.slug}`;
  const title = `${c.short} in Pune — All Areas | Sahara`;
  const description = `${c.name} across East, West, North and South Pune and PCMC. Choose your area. Trained in-house staff, written quote, since 2012.`;
  return { title, description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { type: "website", url, title, description, siteName: "Sahara Cleaning Services", locale: "en_IN" } };
}

export default async function CategoryHub({ params }: Props) {
  const slug = (await params).category;
  const svc = catalogServiceBySlug(slug);
  if (svc) return <CatalogServicePage s={svc} />;
  const c = categoryBySlug(slug);
  if (!c) notFound();
  const settings = await getCompanySettings();
  const WA = `Hi Sahara, I need ${c.name} in Pune.`;
  const faqs = [{ q: `Where do you offer ${c.keyword} in Pune?`, a: `Across ${LOCALITIES.length} localities in East, West, North and South & Central Pune and PCMC. Pick your area below.` }];
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Services", path: "/services" }, { name: c.name, path: `/services/${c.slug}` }]), faqJsonLd(faqs)]} bookHref="/booking" mobileBar={<CategoryBar waText={WA} cta="Get Quote" href="/booking" />}>
      <CategoryHero image="/marketing/hero-home.webp" alt={`${c.name} in Pune`} title={`${c.name} in Pune`} subtitle={c.intro} points={c.includes.slice(0, 4)} waText={WA} badge={VERTICALS[c.vertical].label} cta="Book Now" ctaHref="/booking" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <ZoneAccordion seoSlug={c.slug} service={c.short} />
        <section className="rounded-2xl bg-white p-5 text-sm shadow-sm">
          <h2 className="text-lg font-bold">Other services</h2>
          <p className="mt-2 flex flex-wrap gap-2">{SERVICE_CATEGORIES.filter((s) => s.slug !== c.slug).map((s) => <Link key={s.slug} href={`/services/${s.slug}`} className="rounded-full border px-3 py-1 font-medium">{s.short}</Link>)}</p>
        </section>
        <Faqs faqs={faqs} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}

/** JSON-LD Service entity for a catalog service page (provider = the business graph on every page). */
function catalogServiceJsonLd(s: CatalogService) {
  const url = `${BASE_URL}${servicePath(s.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: s.name,
    serviceType: s.name,
    description: s.intro,
    url,
    image: `${BASE_URL}${s.image}`,
    category: catalogCategory(s.category).label,
    provider: { "@type": "LocalBusiness", name: "Sahara Cleaning Services", url: BASE_URL, telephone: "+917083347130" },
    areaServed: [{ "@type": "City", name: "Pune" }, { "@type": "City", name: "Pimpri-Chinchwad" }],
    hasOfferCatalog: { "@type": "OfferCatalog", name: s.name, itemListElement: s.includes.map((i) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: i } })) },
  };
}

/** One page per catalog service (rebuild 2026-11-02): hero, price block (BHK / rates / inspection), scope, work gallery, areas, FAQ. */
async function CatalogServicePage({ s }: { s: CatalogService }) {
  const settings = await getCompanySettings();
  const cat = catalogCategory(s.category);
  const WA = `Hi Sahara, I need ${s.name} in Pune.`;
  const inspection = s.pricing.mode === "inspection";
  const seo = s.seoCategory ? categoryBySlug(s.seoCategory) : undefined;
  const siblings = servicesIn(s.category).filter((x) => x.slug !== s.slug);
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), catalogServiceJsonLd(s), breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: s.name, path: servicePath(s.slug) }]), faqJsonLd(s.faqs)]}
      mobileBar={<CategoryBar waText={WA} cta={inspection ? "Get Quote" : "Book Now"} href="#book" />}
    >
      <CategoryHero image={s.image} alt={s.imageAlt} title={`${s.name} in Pune`} subtitle={s.intro} points={s.includes.slice(0, 4)} waText={WA} badge={cat.label} cta={inspection ? "Request Site Inspection" : "Book Now"} ctaHref="#book" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-[#0a2540]/60"><Link href="/" className="hover:text-primary">Home</Link> › <Link href="/services" className="hover:text-primary">Services</Link> › <span className="font-semibold text-[#0a2540]">{s.name}</span></nav>
        <ServicePricing service={s} />
        <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="text-xl font-extrabold">What&apos;s included</h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {s.includes.map((i) => <li key={i} className="rounded-xl bg-[#eef4fb] px-3 py-2 font-medium">{i}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#0a2540] p-4 text-white">
            <p className="text-sm font-extrabold">{inspection ? "Not sure of the scope?" : "Ready to book?"}</p>
            <p className="mt-1 text-sm text-white/75">{inspection ? "Book a free site visit — written quote, no obligation." : "Share your date and location — you get a request ID instantly."}</p>
            <LeadButton intent={{ service: s.name, inspection }} className="mt-3 min-h-11 w-full rounded-xl bg-amber-400 text-sm font-extrabold text-[#0a2540]">{inspection ? "Request Site Inspection" : "Book Now"}</LeadButton>
          </div>
        </section>
        {!inspection && s.category !== "residential" && <InspectionFlow service={`${s.name} — larger / custom job`} title="Larger or custom job? Get it inspected" />}
        <WorkGallery category={s.gallery === "Other" ? undefined : s.gallery} title={`Before & after — ${s.name}`} fallback={[{ src: s.image, alt: s.imageAlt }, ...CATALOG_SERVICES.filter((x) => x.category === s.category && x.image !== s.image).slice(0, 3).map((x) => ({ src: x.image, alt: x.imageAlt }))].filter((f, n, a) => a.findIndex((y) => y.src === f.src) === n)} />
        {seo && <ZoneAccordion seoSlug={seo.slug} service={s.name} />}
        {siblings.length > 0 && (
          <section className="rounded-2xl bg-white p-5 text-sm shadow-sm">
            <h2 className="text-lg font-bold">More {cat.label.replace(" (B2B)", "")}</h2>
            <p className="mt-2 flex flex-wrap gap-2">{siblings.map((x) => <Link key={x.slug} href={servicePath(x.slug)} className="rounded-full border px-3 py-1 font-medium hover:border-primary hover:text-primary">{x.name}</Link>)}</p>
          </section>
        )}
        <ClientMarquee />
        <Faqs faqs={s.faqs} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
