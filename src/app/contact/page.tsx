import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, BASE_URL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { ContactForm } from "@/components/public/contact-form";
import { BranchCards } from "@/components/public/branch-cards";
import { FestivalZoneEffects } from "@/components/public/festival-announcement";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { breadcrumbJsonLd } from "@/lib/seo-schema";

export const revalidate = 86400;
const TITLE = "Contact Sahara Cleaning Services Pune — Magarpatta & Mohammadwadi";
const DESC = "Call, WhatsApp or message Sahara Cleaning Services. Two Pune branches — Magarpatta City (411028) and Mohammadwadi (411060) — with directions and a same-day reply.";
export const metadata: Metadata = { title: TITLE, description: DESC, alternates: { canonical: `${BASE_URL}/contact` }, robots: { index: true, follow: true }, openGraph: { type: "website", url: `${BASE_URL}/contact`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN" } };

const WA = "Hi Sahara, I'd like to enquire about your services in Pune.";
const FAQS = [
  { q: "How do I contact Sahara Cleaning Services in Pune?", a: "Use the form on this page, call or WhatsApp either branch, or book online. A team member replies the same day." },
  { q: "Which branch serves my area?", a: "Magarpatta City serves East and North Pune. Mohammadwadi serves West Pune, PCMC, South and Central Pune." },
];

export default async function ContactPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), breadcrumbJsonLd([{ name: "Home", path: "/booking" }, { name: "Contact", path: "/contact" }]), faqJsonLd(FAQS)]} bookHref="/booking">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a2540] via-[#0f3d5e] to-[#0F766E] px-4 py-10 text-white sm:py-14">
        <FestivalZoneEffects zone="hero" />
        <div className="relative mx-auto max-w-6xl">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Contact Sahara Cleaning Services</h1>
          <p className="mt-2 max-w-2xl text-lg text-white/85">Two Pune branches, one team. Message us and we reply the same day.</p>
        </div>
      </section>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section aria-labelledby="branches-title">
          <h2 id="branches-title" className="mb-3 text-2xl font-extrabold text-[#0a2540]">Our branches</h2>
          <BranchCards />
        </section>
        <section aria-labelledby="form-title" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e6f4f1] to-[#eef4fb] p-3 sm:p-6">
          <h2 id="form-title" className="sr-only">Contact form</h2>
          <FestivalZoneEffects zone="middle" />
          <div className="relative"><ContactForm /></div>
        </section>
      </main>
    </LandingShell>
  );
}
