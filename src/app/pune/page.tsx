import type { Metadata } from "next";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { AREA_SERVICES, CLUSTERS, PUNE_AREAS, type AreaCluster } from "@/lib/pune-areas";
import { breadcrumbJsonLd } from "@/lib/seo-schema";
import { LandingShell, Faqs, Terms, AreasBadge, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar, StickyWhatsApp } from "@/components/public/category-landing";

// Hub page: every Pune sub-market we serve, grouped by part of the city, plus the five service categories.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cleaning, Pest Control, Painting & Housekeeping AMC Across Pune | Sahara Cleaning Services",
  description: "Sahara Cleaning Services serves Magarpatta, Hadapsar, Kharadi, Baner, Wakad, Hinjewadi, Kothrud, PCMC and more — home and office cleaning, pest control, painting, facility management AMC.",
  alternates: { canonical: `${BASE_URL}/pune` },
};

const WA = "Hi Sahara, I need a quote for a service in Pune.";
const FAQS = [
  { q: "Which parts of Pune do you serve?", a: "East Pune (Magarpatta, Hadapsar, Kharadi, Viman Nagar, Wagholi, Undri, NIBM Road, Kondhwa, Koregaon Park, Kalyani Nagar), West Pune (Baner, Wakad, Hinjewadi, Aundh), Kothrud and Pimpri-Chinchwad (PCMC)." },
  { q: "Which services do you offer?", a: "Home deep cleaning, commercial and office cleaning, pest control, interior and exterior painting, and facility management with housekeeping AMC." },
  { q: "How do I get a quote?", a: "Book online at booking.saharacleaningservices.com/booking or call or WhatsApp 7083347130 / 8956567130." },
];

export default async function PuneHubPage() {
  const settings = await getCompanySettings();
  const groups = (Object.keys(CLUSTERS) as AreaCluster[]).map((k) => ({ key: k, ...CLUSTERS[k], areas: PUNE_AREAS.filter((a) => a.cluster === k) })).filter((g) => g.areas.length);
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[businessJsonLd(), breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Pune areas", path: "/pune" }]), faqJsonLd(FAQS)]}
      bookHref="/booking"
      mobileBar={<CategoryBar waText={WA} cta="Get Quote" href="/booking" />}
    >
      <CategoryHero
        image="/marketing/hero-home.webp"
        alt="Sahara cleaning crew in Royal Blue uniform with a floor scrubbing machine in a Pune home"
        title="Cleaning, Housekeeping & Pest Control Across Pune"
        subtitle="One trusted partner for home cleaning, office cleaning, pest control, painting and facility management in Pune and PCMC."
        points={["Trained in-house staff", "Written quotes and proposals", "East Pune to PCMC", "Serving Pune since 2012"]}
        waText={WA}
        badge="Pune & PCMC"
        cta="Book Now"
        ctaHref="/booking"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Our five services</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {AREA_SERVICES.map((s) => (
              <li key={s.key} className="rounded-xl border p-3">
                <Link href={s.path} className="font-semibold text-primary underline-offset-2 hover:underline">{s.name}</Link>
                <p className="mt-1 text-sm text-[#0a2540]/75">{s.text}</p>
              </li>
            ))}
          </ul>
        </section>
        {groups.map((g) => (
          <section key={g.key} className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">{g.label}</h2>
            <p className="mt-1 text-sm text-[#0a2540]/75">Typical premises: {g.focus}.</p>
            <p className="mt-3 flex flex-wrap gap-2 text-sm">
              {g.areas.map((a) => <Link key={a.slug} href={`/pune/${a.slug}`} className="rounded-full bg-[#eef3fb] px-3 py-1 font-medium text-primary">{a.name}</Link>)}
            </p>
          </section>
        ))}
        <AreasBadge />
        <Faqs faqs={FAQS} compact />
        <Terms />
      </main>
      <StickyWhatsApp waText={WA} />
    </LandingShell>
  );
}
