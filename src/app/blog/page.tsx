import type { Metadata } from "next";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { CATALOG_CATEGORIES, servicesIn, servicePath } from "@/config/service-catalog";
import { getAllPosts } from "@/lib/blog";

// Rendered per request: reads Company Settings (the Docker build has no database).
export const dynamic = "force-dynamic";

// Blog route for SEO articles (owner 2026-11-02). While there are no published posts the page is noindex and stays out of the
// sitemap, so search engines never see an empty "thin" page; once the first article exists (content/blog/*.md) it becomes indexable.
export async function generateMetadata(): Promise<Metadata> {
  const hasPosts = getAllPosts().length > 0;
  return {
    title: "Cleaning & Pest Control Guides | Sahara Cleaning Services Blog",
    description: "Cleaning, pest control and painting guides for Pune homes and offices from Sahara Cleaning Services.",
    alternates: { canonical: `${BASE_URL}/blog` },
    robots: { index: hasPosts, follow: true },
  };
}

export default async function BlogPage() {
  const settings = await getCompanySettings();
  const posts = getAllPosts();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText="Hi Sahara, I have a question." jsonLd={[businessJsonLd()]}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-3xl font-extrabold text-[#0a2540]">Sahara Blog</h1>
          <p className="mt-1 text-[#0a2540]/70">
            {posts.length
              ? "Guides on deep cleaning, pest control and painting for Pune homes and offices."
              : "Guides on deep cleaning, pest control and painting for Pune homes and offices — first articles coming soon. Meanwhile, every service page explains the full scope, rates and process."}
          </p>
        </header>
        {posts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((p) => (
              <article key={p.slug} className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-[#0a2540]"><Link href={`/blog/${p.slug}`} className="hover:text-primary">{p.title}</Link></h2>
                <p className="mt-2 text-sm text-[#0a2540]/70">{p.excerpt}</p>
                <Link href={`/blog/${p.slug}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Read the guide →</Link>
              </article>
            ))}
          </div>
        )}
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
