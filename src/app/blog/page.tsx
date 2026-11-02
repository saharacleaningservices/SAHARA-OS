import type { Metadata } from "next";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { CATALOG_CATEGORIES, servicesIn, servicePath } from "@/config/service-catalog";

// Rendered per request: reads Company Settings (the Docker build has no database).
export const dynamic = "force-dynamic";

// Blog route for future SEO articles (owner 2026-11-02). Until the first article is published the page is noindex and stays out
// of the sitemap, so search engines never see an empty "thin" page; it links visitors to the service guides instead.
export const metadata: Metadata = {
  title: "Cleaning & Pest Control Guides | Sahara Cleaning Services Blog",
  description: "Cleaning, pest control and painting guides for Pune homes and offices from Sahara Cleaning Services.",
  alternates: { canonical: `${BASE_URL}/blog` },
  robots: { index: false, follow: true },
};

export default async function BlogPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText="Hi Sahara, I have a question." jsonLd={[businessJsonLd()]}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-3xl font-extrabold text-[#0a2540]">Sahara Blog</h1>
          <p className="mt-1 text-[#0a2540]/70">Guides on deep cleaning, pest control and painting for Pune homes and offices — first articles coming soon. Meanwhile, every service page explains the full scope, rates and process.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {CATALOG_CATEGORIES.map((c) => (
            <section key={c.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold text-[#0a2540]"><Link href={`/services/${c.slug}`} className="hover:text-primary">{c.label}</Link></h2>
              <ul className="mt-2 space-y-1 text-sm">
                {servicesIn(c.id).map((s) => <li key={s.slug}><Link href={servicePath(s.slug)} className="text-primary hover:underline">{s.name} — scope, rates &amp; booking</Link></li>)}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </LandingShell>
  );
}
