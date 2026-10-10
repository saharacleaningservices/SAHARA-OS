import type { ComponentType } from "react";
import { AppWindow, Bath, Brush, Bug, Building2, Fan, Hammer, Layers, Monitor, PaintRoller, Ruler, ShieldCheck, Sofa, Sparkles, Sun, UtensilsCrossed, Wind, Check, Phone, MessageCircle } from "lucide-react";
import { AttributionCapture } from "@/components/public/attribution-capture";
import { MarketingTags } from "@/components/public/marketing-tags";
import { CategoryLeadForm } from "@/components/public/category-lead-form";
import { PriceSelector } from "@/components/public/price-selector";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { CompanyLogo } from "@/components/shared/company-logo";
import { BASE_URL, buildHomeRows, festivalPriceNote, businessJsonLd } from "@/components/public/landing-kit";
import { CONTACT, GOOGLE_MAPS_URL, livePkgs, reviewCountLabel } from "@/lib/marketing-content";
import { activeCampaign, todayIST } from "@/lib/pricing-master";
import { PPC_PAGES, type PpcConfig, type PpcIcon } from "@/lib/ppc-landing-content";
import { COMPANY } from "@/lib/constants";
import { toWhatsAppLink } from "@/lib/utils";
import { getCompanySettings } from "@/server/settings";
import { getLivePricing } from "@/server/pricing";
import { getFeaturedGallery } from "@/server/actions/gallery";

// Google Ads landing pages (/landing/*): one service per page, a sticky lead form in the
// hero, and nothing that leads into the main booking funnel — no site nav, no links to other
// services. UTMs / gclid are captured by AttributionCapture and attached to the CRM lead by
// the form. Trust numbers come from CRM Settings (never typed here).

const ICONS: Record<PpcIcon, ComponentType<{ className?: string }>> = {
  window: AppWindow, sofa: Sofa, bath: Bath, kitchen: UtensilsCrossed, balcony: Sun, fan: Fan, floor: Brush, cobweb: Wind, wall: Layers,
  desk: Monitor, glass: AppWindow, building: Building2,
  ruler: Ruler, prep: Hammer, layers: Layers, roller: PaintRoller, finish: Sparkles, shield: ShieldCheck,
  bug: Bug,
};

const fmt = (n: string) => `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
const waLink = (text: string) => `${toWhatsAppLink(CONTACT.whatsapp)}?text=${encodeURIComponent(text)}`;

export const ppcMetadata = (cfg: PpcConfig) => ({
  title: cfg.metaTitle,
  description: cfg.metaDescription,
  // Paid-traffic page: kept out of organic search so it never competes with the main service pages.
  robots: { index: false, follow: false },
  alternates: { canonical: `${BASE_URL}/landing/${cfg.slug}` },
});

export async function PpcPage({ slug }: { slug: PpcConfig["slug"] }) {
  const cfg = PPC_PAGES[slug];
  const [settings, pricing, galleryAll] = await Promise.all([
    getCompanySettings().catch(() => null),
    cfg.fixedPrices ? getLivePricing() : Promise.resolve(null),
    getFeaturedGallery(24, cfg.galleryCategory).catch(() => []),
  ]);
  const rating = settings?.googleRating?.trim() || "";
  const reviews = reviewCountLabel(settings?.googleReviewCount);
  const trust = [rating ? `⭐ ${rating} Rated` : null, reviews ? `${reviews} Verified Google Reviews in Pune & PCMC` : null].filter(Boolean).join(" | ");
  // Only real owner-uploaded before/after pairs for THIS category; nothing is shown until they exist.
  const pairs = galleryAll.filter((g) => g.type === "PHOTO" && g.pairKey && (g.kind === "BEFORE" || g.kind === "AFTER"));

  let homeRows: ReturnType<typeof buildHomeRows> | null = null;
  let priceNote = "";
  let festivalOn = false;
  if (pricing) {
    const campaign = activeCampaign(pricing.festivals, todayIST());
    festivalOn = !!campaign;
    homeRows = buildHomeRows(livePkgs(pricing.items, "PREMIUM", campaign?.current), livePkgs(pricing.items, "PLATINUM", campaign?.current));
    priceNote = festivalPriceNote(campaign);
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] pb-16 text-[#0a2540] sm:pb-0">
      <AttributionCapture />
      <MarketingTags withPixel />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd()) }} />

      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <CompanyLogo logoUrl={settings?.logoUrl} className="h-[40px] w-auto max-w-[160px]" />
          <a href={`tel:+91${CONTACT.call[0]}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-bold text-white">
            <Phone className="size-4" /> {fmt(CONTACT.call[0])}
          </a>
        </div>
      </header>

      {/* Hero: copy + trust + call / WhatsApp on the left, sticky lead form on the right */}
      <section className="relative isolate overflow-hidden bg-[#0a2540] text-white">
        <img src={cfg.image} alt={cfg.alt} className="absolute inset-0 -z-10 size-full object-cover opacity-25" fetchPriority="high" />
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-start md:py-10">
          <div>
            {festivalOn && cfg.fixedPrices && <p className="mb-2 inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold text-[#0a2540]">🪔 Festival prices live</p>}
            <h1 className="text-[26px] font-extrabold leading-tight sm:text-4xl">{cfg.title}</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{cfg.subtitle}</p>
            <ul className="mt-3 space-y-1.5 text-[13px] font-semibold sm:text-sm">
              {trust && <li>{trust}</li>}
              <li className="flex items-start gap-1.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" /> 100% In-House Staff in Branded Uniforms &amp; Verified ID Badges</li>
              <li className="flex items-start gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-300" /> {cfg.pricingLine}</li>
            </ul>
            <div className="mt-4 grid max-w-md grid-cols-[1.3fr_1fr] gap-2">
              <a href={`tel:+91${CONTACT.call[0]}`} className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-[13px] font-bold text-primary sm:text-sm"><Phone className="size-4 shrink-0" /> Call {fmt(CONTACT.call[0])}</a>
              <a href={waLink(cfg.waText)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-success px-2 text-[13px] font-bold text-white sm:text-sm"><MessageCircle className="size-4 shrink-0" /> WhatsApp Quote</a>
            </div>
          </div>
          <div className="md:sticky md:top-4">
            <CategoryLeadForm
              service={cfg.service}
              serviceLabel={cfg.serviceLabel}
              campaignName={cfg.campaignName}
              waNumber={CONTACT.whatsapp}
              title={cfg.formTitle}
              cta="Get Instant Quote / Call Back"
              stacked
              note={cfg.formNote}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {homeRows && <PriceSelector rows={homeRows} note={priceNote} bookHref="#enquiry" hideDetails heading={festivalOn ? "Festival prices — pick your home size" : "Pick your home size"} />}

        <section aria-labelledby="included">
          <h2 id="included" className="text-xl font-bold sm:text-2xl">{cfg.includedHeading}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {cfg.included.map(({ icon, text }) => {
              const Icon = ICONS[icon];
              return (
                <li key={text} className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm shadow-sm">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
                  <span className="pt-1.5">{text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="process">
          <h2 id="process" className="text-xl font-bold sm:text-2xl">How it works</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {cfg.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">{i + 1}</span>
                <span className="text-sm font-bold">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {pairs.length > 0 && (
          <section aria-label="Before and after">
            <BeforeAfterGallery items={pairs} />
          </section>
        )}

        <section className="rounded-2xl bg-[#0a2540] p-5 text-center text-white">
          <h2 className="text-lg font-bold">Ready for a call back?</h2>
          <a href="#enquiry" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-400 px-6 text-sm font-extrabold text-[#0a2540]">Get Instant Quote / Call Back</a>
        </section>
      </main>

      {/* Single clean footer */}
      <footer className="border-t-2 border-primary bg-white text-sm text-[#0a2540]/80">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-center sm:text-left">
          <p className="font-bold text-[#0a2540]">Sahara Cleaning Services · Serving Pune Since 2012</p>
          <address className="not-italic">{CONTACT.address}</address>
          <a href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-sm font-bold text-[#0a2540]">📍 Open in Google Maps</a>
          <p className="text-xs">GSTIN: {COMPANY.gstin}</p>
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-xs sm:justify-start"><a href="/privacy-policy" className="inline-flex min-h-11 items-center underline">Privacy Policy</a><span aria-hidden>·</span><a href="/terms" className="inline-flex min-h-11 items-center underline">Terms &amp; Conditions</a></p>
        </div>
      </footer>

      <StickyBar waText={cfg.waText} />
    </div>
  );
}

/** Mobile floating bar: Call Now | WhatsApp Quote. */
function StickyBar({ waText }: { waText: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-border bg-white text-center text-sm font-bold sm:hidden">
      <a href={`tel:+91${CONTACT.call[0]}`} className="flex min-h-12 items-center justify-center text-primary">📞 Call Now</a>
      <a href={waLink(waText)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center bg-success text-white">💬 WhatsApp Quote</a>
    </div>
  );
}
