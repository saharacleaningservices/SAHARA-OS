import Link from "next/link";
import { BadgeCheck, CalendarClock, ReceiptText, ShieldCheck } from "lucide-react";
import { getCompanySettings } from "@/server/settings";
import { getPublicPricing } from "@/server/pricing";
import { LandingShell, businessJsonLd, buildHomeRows } from "@/components/public/landing-kit";
import { HomeHeroSlider, type HeroPhoto } from "@/components/public/home-hero-slider";
import { HomeServiceDrill, type DrillRate } from "@/components/public/home-service-drill";
import { BranchDetails, ClientMarquee, ComboSwiper, GoogleRatingBadge } from "@/components/public/catalog-blocks";
import { CATALOG_SERVICES, servicePath } from "@/config/service-catalog";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { TRUST } from "@/lib/booking-target";
import { livePkgs } from "@/lib/marketing-content";
import { PEST_STARTING_RATES, activeCampaign, todayIST } from "@/lib/pricing-master";
import { homeHighlights } from "@/lib/service-scope";

const WA = "Hi Sahara, I'd like a quote for a service in Pune.";

const PHOTOS: HeroPhoto[] = [
  { src: "/marketing/hero-home.webp", alt: "Sahara technician running a floor scrubber during home deep cleaning in Pune" },
  { src: "/marketing/hero-commercial-v2.webp", alt: "Sahara team in Royal Blue uniforms cleaning a Pune office", position: "36% 30%" },
  { src: "/marketing/service-painting.webp", alt: "Sahara painters rolling a living-room wall during interior painting" },
  { src: "/marketing/service-pest-control.webp", alt: "Sahara pest control technician treating kitchen cabinet edges" },
];

/**
 * Public homepage — app-like, zero clutter (owner 2026-11-02). Order is fixed by the owner:
 * text-free hero slider → Google 4.9★ badge → verified-client marquee → About → 4 visual service cards (drill-down sheets) →
 * horizontal combo swiper → branch details → footer. No price cards, inspection block or relocation section on the front view
 * (relocation lives in the sidebar menu). Layout model: BOXED (max-w-6xl); the hero is the only full-bleed element.
 */
export async function HomePage() {
  const [settings, pricing] = await Promise.all([getCompanySettings().catch(() => null), getPublicPricing()]);
  const reviewUrl = settings?.googleReviewUrl?.trim() || GOOGLE_REVIEW_URL;
  const campaign = activeCampaign(pricing.festivals, todayIST());
  const rows = buildHomeRows(livePkgs(pricing.items, "PREMIUM", campaign?.current), livePkgs(pricing.items, "PLATINUM", campaign?.current));
  const individual: DrillRate[] = CATALOG_SERVICES.filter((s) => s.category === "individual").flatMap((s) => {
    const item = pricing.items.find((i) => i.contentId === s.pricing.contentIds?.[0]);
    return item ? [{ name: s.name, price: item.price, unit: item.unit, rule: item.rule, href: servicePath(s.slug) }] : [];
  });
  const pest: DrillRate[] = PEST_STARTING_RATES.map((p) => ({ name: p.name, price: p.from, rule: p.note }));
  const years = Math.max(1, new Date().getFullYear() - TRUST.since);

  return (
    <LandingShell logoUrl={settings?.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph()]}>
      <HomeHeroSlider photos={PHOTOS} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-8 sm:space-y-10">
        <div className="-mt-7 relative z-10 space-y-5">
          <GoogleRatingBadge reviewUrl={reviewUrl} rating={settings?.googleRating || TRUST.rating} />
          <ClientMarquee />
        </div>

        <section aria-labelledby="about-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">About us</p>
          <h1 id="about-title" className="mt-1 text-2xl font-extrabold leading-tight text-[#0a2540] sm:text-3xl">Sahara Cleaning Services — Pune&apos;s trusted cleaning, pest control &amp; painting team</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0a2540]/80 sm:text-base">Since {TRUST.since}, our own trained crew has looked after homes, offices, societies and showrooms across Pune and PCMC from our Magarpatta City and Mohammadwadi branches. Fixed rates where the job is standard, a free site inspection where it isn&apos;t — and a GST invoice every time.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: CalendarClock, t: `${years}+ years`, s: `Since ${TRUST.since}` },
              { icon: ShieldCheck, t: "In-house crew", s: "Trained & verified" },
              { icon: BadgeCheck, t: "Fixed rates", s: "No hidden charges" },
              { icon: ReceiptText, t: "GST invoice", s: "For every job" },
            ].map(({ icon: Icon, t, s }) => (
              <li key={t} className="rounded-2xl bg-[#eef4fb] p-3"><Icon className="size-5 text-primary" aria-hidden /><p className="mt-1 text-sm font-extrabold text-[#0a2540]">{t}</p><p className="text-xs text-[#0a2540]/65">{s}</p></li>
            ))}
          </ul>
          <Link href="/scope-of-work" className="mt-3 inline-block text-sm font-bold text-primary">What&apos;s included in each service →</Link>
        </section>

        <HomeServiceDrill rows={rows} individual={individual} pest={pest} inclusions={{ Premium: homeHighlights("Premium"), Platinum: homeHighlights("Platinum") }} />
        <ComboSwiper />
        <BranchDetails />
      </main>
    </LandingShell>
  );
}
