import type { Metadata } from "next";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, Terms, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, StickyWhatsApp } from "@/components/public/category-landing";
import { SERVICE_CATEGORIES, LOCALITIES, VERTICALS } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { breadcrumbJsonLd } from "@/lib/seo-schema";
import { HomeAbout } from "@/components/public/home-about";
import { ClientCarousel } from "@/components/ui/client-carousel";
import { CLIENT_LOGOS } from "@/lib/client-logos";

// Rendered per request like every other public page: the Docker build has no database, so nothing that reads
// Company Settings may be prerendered at build time (Coolify build failed on /b2b/architects, 2026-11-01).
export const dynamic = "force-dynamic";
const TITLE = "Cleaning, Pest Control, Painting & Facility Management in Pune | Sahara";
const DESC = "Home deep cleaning, office housekeeping, post-interior cleaning, pest control and painting across East, West, North and South Pune and PCMC. Trained in-house staff since 2012.";
export const metadata: Metadata = { title: TITLE, description: DESC, alternates: { canonical: `${BASE_URL}/services` }, robots: { index: true, follow: true }, openGraph: { type: "website", url: `${BASE_URL}/services`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN" } };

const WA = "Hi Sahara, I need a quote for a service in Pune.";
const FAQS = [
  { q: "Which services does Sahara offer in Pune?", a: "Residential deep cleaning, commercial and corporate facility management, post-interior cleaning, pest control, and interior and exterior painting." },
  { q: "Which parts of Pune do you serve?", a: `East, West, North and South & Central Pune plus Pimpri-Chinchwad — ${LOCALITIES.length} localities, each with its own service page.` },
];

export default async function ServicesHub() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Services", path: "/services" }]), faqJsonLd(FAQS)]} bookHref="/booking" mobileBar={<CategoryBar waText={WA} cta="Get Quote" href="/booking" />}>
      <CategoryHero image="/marketing/hero-home.webp" alt="Sahara cleaning crew in Pune" title="Sahara Services Across Pune & PCMC" subtitle="Pick a service, then your area — every page names the branch that serves you." points={["Trained in-house staff", "Written quote before work", "Magarpatta & Mohammadwadi branches", "Since 2012 · GST invoice"]} waText={WA} cta="Book Now" ctaHref="/booking" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <HomeAbout reviewUrl={settings.googleReviewUrl?.trim() || undefined} />
        <ClientCarousel logos={CLIENT_LOGOS} />
        <section className="grid gap-3 sm:grid-cols-2">
          {SERVICE_CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/services/${c.slug}`} className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-primary">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{VERTICALS[c.vertical].label}</p>
              <h2 className="mt-1 text-base font-bold">{c.name}</h2>
              <p className="mt-1 text-sm text-[#0a2540]/75">{c.intro}</p>
            </Link>
          ))}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm text-sm">
          <h2 className="text-lg font-bold">For businesses</h2>
          <p className="mt-2 flex flex-wrap gap-2">
            <Link href="/b2b/architects" className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">Architects & interior designers</Link>
            <Link href="/b2b/corporate-facility" className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">Corporate facility management</Link>
          </p>
        </section>
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
