import { BadgeCheck, CalendarClock, ShieldCheck } from "lucide-react";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, businessJsonLd } from "@/components/public/landing-kit";
import { HomeHeroSlider, type HeroPhoto } from "@/components/public/home-hero-slider";
import { BranchDetails, ClientMarquee, ComboSwiper, GoogleRatingBadge, HomeServiceCards, ZoneGrid } from "@/components/public/catalog-blocks";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { TRUST } from "@/lib/booking-target";

const WA = "Hi Sahara, I'd like a quote for a service in Pune.";

const PHOTOS: HeroPhoto[] = [
  { src: "/marketing/hero-home.webp", alt: "Sahara technician running a floor scrubber during home deep cleaning in Pune" },
  { src: "/marketing/hero-commercial-v2.webp", alt: "Sahara team in Royal Blue uniforms cleaning a Pune office", position: "36% 30%" },
  { src: "/marketing/service-painting.webp", alt: "Sahara painters rolling a living-room wall during interior painting" },
  { src: "/marketing/service-pest-control.webp", alt: "Sahara pest control technician treating kitchen cabinet edges" },
];

/**
 * Public homepage — app-like, zero clutter (owner 2026-11-02). Order is fixed by the owner:
 * text-free hero slider → slogan + compact Google 4.9★ badge → About → client marquee → 4 visual service cards (each opens its
 * landing page, no price tags) → horizontal combo swiper → 4-zone area grid → branch details → footer. No price cards, inspection block or relocation section on the front view
 * (relocation lives in the sidebar menu). Layout model: BOXED (max-w-6xl); the hero is the only full-bleed element.
 */
export async function HomePage() {
  const settings = await getCompanySettings().catch(() => null);
  const reviewUrl = settings?.googleReviewUrl?.trim() || GOOGLE_REVIEW_URL;
  const years = Math.max(1, new Date().getFullYear() - TRUST.since);

  return (
    <LandingShell logoUrl={settings?.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph()]}>
      <HomeHeroSlider photos={PHOTOS} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-8 sm:space-y-10">
        <section aria-labelledby="slogan" className="relative z-10 -mt-6 rounded-3xl bg-white px-4 py-5 text-center shadow-md sm:px-8">
          <h1 id="slogan" className="text-2xl font-extrabold leading-tight text-[#0a2540] sm:text-3xl">Pune&apos;s #1 Trusted Home Service Partner</h1>
          <div className="mt-3"><GoogleRatingBadge reviewUrl={reviewUrl} rating={settings?.googleRating || TRUST.rating} compact /></div>
        </section>

        <section aria-labelledby="about-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">About us</p>
          <h2 id="about-title" className="mt-1 text-xl font-extrabold text-[#0a2540] sm:text-2xl">Sahara Cleaning Services, Pune — since {TRUST.since}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#0a2540]/80">Our own trained crew looks after homes, offices and societies across Pune & PCMC from Magarpatta City and Mohammadwadi — fixed rates for standard jobs, a free site inspection for the rest.</p>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: CalendarClock, t: `${years}+ Years`, s: `Since ${TRUST.since}` },
              { icon: ShieldCheck, t: "Verified Crew", s: "In-house & trained" },
              { icon: BadgeCheck, t: "Fixed Rates", s: "No hidden charges" },
            ].map(({ icon: Icon, t, s }) => (
              <li key={t} className="rounded-2xl bg-[#eef4fb] p-3 text-center"><Icon className="mx-auto size-6 text-primary" aria-hidden /><p className="mt-1 text-sm font-extrabold text-[#0a2540]">{t}</p><p className="text-[11px] text-[#0a2540]/65">{s}</p></li>
            ))}
          </ul>
        </section>

        <ClientMarquee />
        <HomeServiceCards />
        <ComboSwiper />
        <ZoneGrid />
        <BranchDetails />
      </main>
    </LandingShell>
  );
}
