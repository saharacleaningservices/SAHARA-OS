import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { pincodePageBySlug } from "@/lib/pincode-pages";
import { LandingShell, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";

// Pune pincode landing pages: /cleaning-services-<locality>-<pincode> (src/lib/pincode-pages.ts), one route folder per page.
// The body carries its own FAQPage / Service / Breadcrumb JSON-LD;
// the shell adds the Organization + both branch nodes, as on every other SEO page.




export function pincodeMetadata(slug: string): Metadata {
  const page = pincodePageBySlug(slug);
  if (!page) return {};
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: `${BASE_URL}/${page.slug}` },
    robots: { index: true, follow: true },
  };
}

// Styles for the imported body HTML (plain tags, no utility classes).
const BODY =
  "mx-auto max-w-4xl px-4 py-8 text-[15px] leading-relaxed sm:px-6 " +
  "[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:mb-4 " +
  "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 " +
  "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 " +
  "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
  "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline " +
  "[&_img]:my-4 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-2xl [&_address]:not-italic [&_address]:my-4";

export async function PincodeLanding({ slug }: { slug: string }) {
  const page = pincodePageBySlug(slug);
  if (!page) notFound();
  const settings = await getCompanySettings();
  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={`Hi Sahara, I need a quote for a service (${page.slug}).`}
      jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph()]}
    >
      <main className={BODY} dangerouslySetInnerHTML={{ __html: page.body }} />
    </LandingShell>
  );
}
