import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { getPost, renderMarkdown } from "@/lib/blog";

// Rendered per request: reads Company Settings (the Docker build has no database).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Search titles stay ≤ 70 chars where possible: full brand suffix for short titles, "| Sahara" for long ones. */
function blogTitle(t: string): string {
  const full = `${t} | Sahara Cleaning Services`;
  if (full.length <= 70) return full;
  const short = `${t} | Sahara`;
  return short.length <= 90 ? short : `${t.slice(0, 80).trimEnd()}… | Sahara`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Article not found | Sahara Cleaning Services", robots: { index: false, follow: false } };
  const url = `${BASE_URL}/blog/${post.slug}`;
  return {
    title: blogTitle(post.title),
    description: post.excerpt,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.excerpt, url, type: "article", publishedTime: post.date },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const settings = await getCompanySettings();
  const url = `${BASE_URL}/blog/${post.slug}`;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Sahara Cleaning Services" },
    mainEntityOfPage: url,
    keywords: post.keywords.join(", "),
  };
  const dateLabel = post.date ? new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
  return (
    <LandingShell logoUrl={settings.logoUrl} waText="Hi Sahara, I read your post-Diwali cleaning guide and want to book." jsonLd={[businessJsonLd(), articleLd]}>
      <main className="mx-auto max-w-3xl px-4 py-8 text-[#0a2540]">
        <nav className="text-sm text-[#0a2540]/60">
          <Link href="/blog" className="hover:text-primary">Blog</Link> / <span>{post.title}</span>
        </nav>
        <article>
          <header className="mt-3">
            <h1 className="text-3xl font-extrabold leading-tight">{post.title}</h1>
            <p className="mt-2 text-sm text-[#0a2540]/60">{post.author}{dateLabel ? ` · ${dateLabel}` : ""}</p>
          </header>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
        </article>
      </main>
    </LandingShell>
  );
}
