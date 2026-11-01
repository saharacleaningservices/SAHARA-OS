import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, Terms, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, StickyWhatsApp } from "@/components/public/category-landing";
import { LOCALITIES, SERVICE_CATEGORIES, VERTICALS, ZONES, categoryBySlug, seoPagePath, type ZoneKey } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { breadcrumbJsonLd } from "@/lib/seo-schema";

// Rendered per request like every other public page: the Docker build has no database, so nothing that reads
// Company Settings may be prerendered at build time (Coolify build failed on /b2b/architects, 2026-11-01).
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = categoryBySlug((await params).category);
  if (!c) return {};
  const url = `${BASE_URL}/services/${c.slug}`;
  const title = `${c.short} in Pune — All Areas | Sahara`;
  const description = `${c.name} across East, West, North and South Pune and PCMC. Choose your area. Trained in-house staff, written quote, since 2012.`;
  return { title, description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { type: "website", url, title, description, siteName: "Sahara Cleaning Services", locale: "en_IN" } };
}

export default async function CategoryHub({ params }: Props) {
  const c = categoryBySlug((await params).category);
  if (!c) notFound();
  const settings = await getCompanySettings();
  const WA = `Hi Sahara, I need ${c.name} in Pune.`;
  const faqs = [{ q: `Where do you offer ${c.keyword} in Pune?`, a: `Across ${LOCALITIES.length} localities in East, West, North and South & Central Pune and PCMC. Pick your area below.` }];
  const zones = Object.keys(ZONES) as ZoneKey[];
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Services", path: "/services" }, { name: c.name, path: `/services/${c.slug}` }]), faqJsonLd(faqs)]} bookHref="/booking" mobileBar={<CategoryBar waText={WA} cta="Get Quote" href="/booking" />}>
      <CategoryHero image="/marketing/hero-home.webp" alt={`${c.name} in Pune`} title={`${c.name} in Pune`} subtitle={c.intro} points={c.includes.slice(0, 4)} waText={WA} badge={VERTICALS[c.vertical].label} cta="Book Now" ctaHref="/booking" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        {zones.map((z) => (
          <section key={z} className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">{c.short} in {ZONES[z].label}</h2>
            <p className="mt-2 flex flex-wrap gap-2 text-sm">
              {LOCALITIES.filter((l) => l.zone === z).map((l) => <Link key={l.slug} href={seoPagePath(c.slug, l.slug)} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{l.name}</Link>)}
            </p>
          </section>
        ))}
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
