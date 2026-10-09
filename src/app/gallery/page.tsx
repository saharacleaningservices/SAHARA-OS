import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { BASE_URL } from "@/components/public/landing-kit";
import { CompanyLogo } from "@/components/shared/company-logo";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { getCompanySettings } from "@/server/settings";
import { COMPANY } from "@/lib/constants";
import { toWhatsAppLink } from "@/lib/utils";

const GALLERY_TITLE = "Our Work — Sahara Cleaning Services, Pune";
const GALLERY_DESCRIPTION = "Before & after photos and result videos from Sahara Cleaning Services.";

export const metadata: Metadata = {
  title: GALLERY_TITLE,
  description: GALLERY_DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/gallery` },
  openGraph: {
    title: GALLERY_TITLE,
    description: GALLERY_DESCRIPTION,
    url: `${BASE_URL}/gallery`,
    siteName: "Sahara Cleaning Services",
    type: "website",
    // Approved existing brand asset (the company logo) — never customer-work or stock imagery.
    images: [{ url: `${BASE_URL}/brand/sahara-logo-hires.png`, width: 1102, height: 465, alt: "Sahara Cleaning Services logo" }],
  },
};

// Gallery content is managed from the CRM admin — always render fresh, never
// freeze it into the static build.
export const dynamic = "force-dynamic";

const CALL_NUMBER = "7083347130";
const WHATSAPP_NUMBER = "8956567130";

const TIPS = [
  "Keep windows open for 30–45 minutes after a deep clean so surfaces dry fully.",
  "Wait 4 hours before placing rugs or furniture back on a freshly cleaned floor.",
  "For sofa & mattress shampooing, avoid use for 6–8 hours until completely dry.",
  "After pest control, don't mop treated skirting/corners for 3–4 days.",
  "Fresh paint needs 7 days to fully cure — wipe gently only after that.",
  "Book a maintenance clean every 3 months to protect the deep-clean finish.",
];

export default async function PublicGalleryPage() {
  const [items, settings] = await Promise.all([getFeaturedGallery(60), getCompanySettings()]);

  return (
    <div className="min-h-screen bg-[#eef4fb] pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/book"><CompanyLogo logoUrl={settings.logoUrl} className="h-[42px] w-auto max-w-[170px]" showTm /></Link>
          <div className="flex items-center gap-2">
            <a href={`tel:+91${CALL_NUMBER}`} className="sahara-pulse flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white">
              <Phone className="size-4" /> Call {CALL_NUMBER}
            </a>
            <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-white">
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      <section className="sahara-gradient text-white">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center">
          <h1 className="font-serif text-2xl italic sm:text-3xl">Our Work — Before &amp; After</h1>
          <p className="mt-1 text-sm text-white/85">Real results from cleaning, painting &amp; pest-control jobs across Pune</p>
          <a href="/book" className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-bold text-primary shadow-lg">Book Your Service</a>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {items.length > 0 ? (
          <BeforeAfterGallery items={items} heading={false} />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
            Our latest before &amp; after photos are being added. Call {CALL_NUMBER} to see recent work in your area.
          </p>
        )}

        <section id="tips" className="scroll-mt-20 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">Cleaning &amp; Aftercare Tips</h2>
          <ul className="mt-3 space-y-2">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="sahara-gradient py-4 text-center text-[11px] text-white/75">
        <Link href="/book" className="hover:text-white">Book a service</Link>
        <span className="mx-2">·</span>
        {COMPANY.name}
        <sup className="ml-0.5 text-[0.7em]">™</sup>
      </footer>
    </div>
  );
}
