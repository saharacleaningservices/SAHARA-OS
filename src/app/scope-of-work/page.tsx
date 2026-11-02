import type { Metadata } from "next";
import Link from "next/link";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Terms, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { CATALOG_CATEGORIES, servicesIn, servicePath } from "@/config/service-catalog";
import { CUSTOMER_REQUIREMENTS } from "@/lib/service-scope";

// Rendered per request: reads Company Settings (the Docker build has no database).
export const dynamic = "force-dynamic";

const TITLE = "Scope of Work — Sahara Cleaning Services, Pune";
const DESC = "What is included in every Sahara service — residential, individual, commercial and relocation & property — and what we need from you on the day.";
export const metadata: Metadata = { title: TITLE, description: DESC, alternates: { canonical: `${BASE_URL}/scope-of-work` }, robots: { index: true, follow: true } };

/** Scope of Work policy (footer link, rebuild 2026-11-02): one section per category, built from the service catalog. */
export default async function ScopeOfWorkPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText="Hi Sahara, I have a question about the scope of work." jsonLd={[businessJsonLd()]}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-3xl font-extrabold text-[#0a2540]">Scope of Work</h1>
          <p className="mt-1 max-w-3xl text-[#0a2540]/70">The standard inclusions for each service. Fixed-rate services follow this scope exactly; inspection-based work is confirmed line by line in your written quotation, which always takes precedence.</p>
        </header>
        {CATALOG_CATEGORIES.map((c) => (
          <section key={c.id} aria-labelledby={`sow-${c.id}`} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <h2 id={`sow-${c.id}`} className="text-xl font-extrabold text-[#0a2540]">{c.label}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {servicesIn(c.id).map((s) => (
                <article key={s.slug} className="rounded-2xl bg-[#eef4fb] p-4">
                  <h3 className="font-extrabold"><Link href={servicePath(s.slug)} className="hover:text-primary">{s.name}</Link> <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">{s.pricing.mode === "inspection" ? "Quoted on inspection" : "Fixed rate"}</span></h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0a2540]/80">{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-extrabold text-[#0a2540]">What we need from you</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0a2540]/80">{CUSTOMER_REQUIREMENTS.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
        <Terms />
      </main>
    </LandingShell>
  );
}
