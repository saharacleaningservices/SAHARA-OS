import Link from "next/link";
import { ArrowRight, Building2, Home } from "lucide-react";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { CategoryHero, CategoryBar } from "@/components/public/category-landing";
import { HomeAbout } from "@/components/public/home-about";
import { BranchCards } from "@/components/public/branch-cards";
import { ClientCarousel } from "@/components/ui/client-carousel";
import { CLIENT_LOGOS } from "@/lib/client-logos";
import { NAV_MEGA } from "@/config/nav-menu";
import { SERVICE_CATEGORIES, VERTICALS, ZONES, LOCALITIES } from "@/config/pune-seo-matrix";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { FunnelCards, CompactPriceSelector } from "@/components/public/landing-kit";
import { ReviewsCarousel, type Review } from "@/components/public/reviews-carousel";

/** Streamlined checkout: Book Now and the BHK price card go here, so the homepage itself never holds the booking form. */
export const CHECKOUT = "/booking/checkout";

const WA = "Hi Sahara, I'd like a quote for a service in Pune.";
export const HOME_FAQS = [
  { q: "What services does Sahara Cleaning Services offer in Pune?", a: "Home deep cleaning, individual cleaning (kitchen, bathroom, sofa, mattress, carpet), commercial deep cleaning, housekeeping and facility management contracts, post-interior cleaning, pest control, and interior and exterior painting." },
  { q: "Which areas of Pune do you cover?", a: `East, West, North and South & Central Pune plus Pimpri-Chinchwad — ${LOCALITIES.length} localities served from our Magarpatta City and Mohammadwadi branches.` },
  { q: "How do I book?", a: "Book online in a few minutes, call either branch, or send us a WhatsApp message. Commercial and painting work is quoted in writing after a free site visit." },
];

/**
 * Public homepage of the standalone Next.js website (owner 2026-11-01: zero WordPress). Served at "/" on the public hosts.
 * Sections: hero → 4-card service grid → BHK selector (inline price card + Book Now) → service showcase → About / trust → Google reviews →
 * logo marquee → every service hub → branches → FAQ → footer. Booking happens on /booking/checkout, never inside this page. Layout model: BOXED (max-w-6xl) throughout; full-bleed only for the hero background.
 */
export async function HomePage() {
  const settings = await getCompanySettings().catch(() => null);
  // Real Google reviews entered in Settings → Featured Reviews; none configured → no slider (never invented testimonials).
  let reviews: Review[] = [];
  try {
    const parsed = settings?.featuredReviews ? JSON.parse(settings.featuredReviews) : [];
    if (Array.isArray(parsed)) reviews = parsed.filter((r) => r && r.text && r.name).slice(0, 8);
  } catch {
    reviews = [];
  }
  const reviewUrl = settings?.googleReviewUrl?.trim() || GOOGLE_REVIEW_URL;
  return (
    <LandingShell logoUrl={settings?.logoUrl} waText={WA} bookHref={`${CHECKOUT}?service=home`} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), faqJsonLd(HOME_FAQS)]} mobileBar={<CategoryBar waText={WA} cta="Book Now" href={`${CHECKOUT}?service=home`} />}>
      <CategoryHero
        image="/marketing/hero-home.webp"
        alt="Sahara Cleaning Services crew deep cleaning a Pune home"
        title="Pune's Trusted Cleaning, Pest Control & Painting Team"
        subtitle="Homes, offices, societies and showrooms across Pune & PCMC — our own trained crew, a written quote before work, and a GST invoice after."
        points={["Trained in-house staff — no sub-contractors", "Written quote before work starts", "Magarpatta City & Mohammadwadi branches", "Serving Pune since 2012"]}
        waText={WA}
        cta="Book Now"
        ctaHref="#services"
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
        {/* Homepage flow (owner 2026-11-01): 4-card grid → simple BHK selector with an inline price card → service details → reviews → FAQ.
            No booking form here: Book Now opens the streamlined checkout (/booking/checkout) with the choice pre-filled. */}
        <div id="services" className="scroll-mt-20 space-y-4">
          <FunnelCards checkoutBase={CHECKOUT} />
          <CompactPriceSelector checkoutBase={CHECKOUT} />
        </div>

        <section aria-labelledby="showcase-title" className="relative overflow-hidden rounded-3xl">
          <h2 id="showcase-title" className="relative text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Our services</h2>
          <div className="relative mt-4 grid gap-5 lg:grid-cols-2">
            {NAV_MEGA.map((m) => (
              <div key={m.id} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
                <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-primary">{m.id === "residential" ? <Home className="size-4" /> : <Building2 className="size-4" />}{m.label}</p>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {m.pillars.map((p) => (
                    <li key={p.title}>
                      <Link href={p.href} className="group flex h-full flex-col rounded-2xl bg-[#eef4fb] p-4 transition hover:ring-2 hover:ring-primary">
                        <span className="font-extrabold text-[#0a2540]">{p.title}</span>
                        <span className="mt-0.5 text-sm text-[#0a2540]/70">{p.blurb}</span>
                        <span className="mt-2 line-clamp-2 text-xs text-[#0a2540]/60">{p.items.map((i) => i.label).join(" · ")}</span>
                        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">Explore <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <HomeAbout reviewUrl={reviewUrl} rating={settings?.googleRating || undefined} />

        {reviews.length > 0 && <ReviewsCarousel reviews={reviews} reviewUrl={reviewUrl} />}

        <ClientCarousel logos={CLIENT_LOGOS} />

        <section aria-labelledby="areas-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <h2 id="areas-title" className="text-2xl font-extrabold text-[#0a2540]">Every service, every area of Pune</h2>
          <p className="mt-1 text-[#0a2540]/70">Pick a service to see the localities we cover and the branch that serves you.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((c) => (
              <li key={c.slug}><Link href={`/services/${c.slug}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 px-4 py-2.5 text-sm font-semibold text-[#0a2540] hover:border-primary hover:text-primary"><span><span className="block text-[11px] font-bold uppercase tracking-wide text-primary/80">{VERTICALS[c.vertical].label}</span>{c.name}</span><ArrowRight className="size-4 shrink-0" /></Link></li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[#0a2540]/60">{Object.values(ZONES).map((z) => z.label).join(" · ")}</p>
        </section>

        <section aria-labelledby="home-branches">
          <h2 id="home-branches" className="mb-3 text-2xl font-extrabold text-[#0a2540]">Visit or call a branch</h2>
          <BranchCards />
        </section>

        <Faqs faqs={HOME_FAQS} />
      </main>
    </LandingShell>
  );
}
