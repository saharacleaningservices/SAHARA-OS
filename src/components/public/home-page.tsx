import { AboutStats, ExpansionBanner } from "@/components/public/home-sections";
import BeforeAfterSection from "@/components/BeforeAfterSection";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, businessJsonLd } from "@/components/public/landing-kit";
import { HomeHeroSlider, type HeroPhoto } from "@/components/public/home-hero-slider";
import { img } from "@/config/image-registry";
import { BranchDetails, ClientMarquee, ComboSwiper, GoogleRatingBadge, HomeServiceCards, ZoneGrid } from "@/components/public/catalog-blocks";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { BRAND_TAGLINE } from "@/lib/brand-tagline";
import { TRUST } from "@/lib/booking-target";

const WA = "Hi Sahara, I'd like a quote for a service in Pune.";

const PHOTOS: HeroPhoto[] = [
  // Clean, text-free hero photos from the central image registry (src/config/image-registry.ts).
  img("hero-home"),
  img("bathroom"),
  { ...img("commercial"), position: "36% 30%" },
  img("painting"),
  img("pest"),
];

/**
 * Public homepage — app-like, zero clutter (owner 2026-11-02, updated 2026-11-03). Order is fixed by the owner:
 * text-free hero slider → slogan + compact Google 4.9★ badge → About + 4 stat cards → text-only expansion banner → real before / after
 * (CRM gallery pairs, hidden until the office adds some) → client marquee → 4 visual service cards (each opens its
 * landing page, no price tags) → horizontal combo swiper → 4-zone area grid → branch details → footer. No price cards, inspection block or relocation section on the front view
 * (relocation lives in the sidebar menu). Layout model: BOXED (max-w-6xl); the hero is the only full-bleed element.
 */
export async function HomePage() {
  const settings = await getCompanySettings().catch(() => null);
  const reviewUrl = settings?.googleReviewUrl?.trim() || GOOGLE_REVIEW_URL;

  return (
    <LandingShell logoUrl={settings?.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph()]}>
      <HomeHeroSlider photos={PHOTOS} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-8 sm:space-y-10">
        {/* Slim trust strip (owner 2026-11-12): sits cleanly BELOW the hero — no negative-margin overlap on technician photos. */}
        <section aria-labelledby="slogan" className="mt-3 flex flex-col items-center justify-between gap-1.5 rounded-2xl bg-white px-4 py-2 text-center shadow-sm sm:flex-row sm:gap-4 sm:py-2.5 sm:text-left">
          <h1 id="slogan" className="text-base font-extrabold leading-tight text-[#0a2540] sm:text-lg">{BRAND_TAGLINE}</h1>
          <GoogleRatingBadge reviewUrl={reviewUrl} rating={settings?.googleRating || TRUST.rating} compact />
        </section>

        <section aria-labelledby="about-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">About us</p>
          <h2 id="about-title" className="mt-1 text-xl font-extrabold text-[#0a2540] sm:text-2xl">Sahara Cleaning Services — Pune &amp; PCMC, since {TRUST.since}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#0a2540]/80">Our own trained crew looks after homes, offices and societies across Pune &amp; PCMC. With 25+ years of combined industry experience and 8,000+ satisfied clients, we offer fixed rates for standard jobs and a free site inspection for the rest.</p>
          <AboutStats />
        </section>

        <ExpansionBanner />
        <ClientMarquee />
        <HomeServiceCards />
        <ComboSwiper />
        {/* Real before / after results carousel (owner 2026-11-03): directly below Our Services / Combo packages. */}
        <BeforeAfterSection />
        <ZoneGrid />
        <BranchDetails />
      </main>
    </LandingShell>
  );
}
