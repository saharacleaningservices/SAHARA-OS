import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Faqs, businessJsonLd, faqJsonLd, HomeBhkPriceCards } from "@/components/public/landing-kit";
import { HomeHeroSlider, type HeroSlide } from "@/components/public/home-hero-slider";
import { CategoryGrid, ComboPackages, InspectionFlow, PartnersMarquee, WorkGallery } from "@/components/public/catalog-blocks";
import { HomeAbout } from "@/components/public/home-about";
import { BranchCards } from "@/components/public/branch-cards";
import { ReviewsCarousel, type Review } from "@/components/public/reviews-carousel";
import { BRANCHES, LOCALITIES } from "@/config/pune-seo-matrix";
import { PUNE_AREAS } from "@/lib/pune-areas";
import { branchGraph, magarpattaBranchExtra } from "@/lib/seo-graph";
import { GOOGLE_REVIEW_URL } from "@/lib/whatsapp-cloud-templates";
import { TRUST } from "@/lib/booking-target";
import { waLink } from "@/lib/marketing-content";

const WA = "Hi Sahara, I'd like a quote for a service in Pune.";
export const HOME_FAQS = [
  { q: "What services does Sahara Cleaning Services offer in Pune?", a: "Residential services (full house deep cleaning, unfurnished and move-in/move-out cleaning, post-interior cleaning, pest control, interior painting), individual services (kitchen, bathroom, sofa, carpet, balcony and windows), commercial services (office, showroom, warehouse, façade, restaurant kitchen, post-construction, AMC and facility management) and relocation & property services (packers & movers, rent agreement & police verification, property snagging)." },
  { q: "How much does home deep cleaning cost in Pune?", a: "1, 2 and 3 BHK homes have fixed Premium and Platinum rates shown on this page. 4 BHK homes, villas and bungalows are priced after a free site inspection." },
  { q: "Which services are priced after an inspection?", a: "Commercial work, post-construction and post-interior cleaning, painting, pest control and relocation services. A supervisor visits, then you receive a written quotation." },
  { q: "Which areas of Pune do you cover?", a: `East, West, North and South & Central Pune plus Pimpri-Chinchwad — ${LOCALITIES.length} localities served from our Magarpatta City and Mohammadwadi branches.` },
  { q: "How do I book?", a: "Tap Book Now, share your name, number, date and location — you get a request ID instantly and our team calls back to confirm. You can also call or WhatsApp either branch." },
];

const SLIDES: HeroSlide[] = [
  { src: "/marketing/hero-home.webp", alt: "Sahara technician running a single-disc floor scrubber in a Pune apartment", eyebrow: "Residential deep cleaning", title: "Fixed-price home deep cleaning, done by our own crew", text: "Transparent 1, 2 & 3 BHK rates. Machines, chemicals and trained staff included.", cta: "Book Now", service: "Full House Deep Cleaning" },
  { src: "/marketing/hero-commercial-v2.webp", alt: "Sahara team vacuuming carpet and wiping desks in a Pune office", eyebrow: "Commercial & AMC", title: "Office, showroom & facility management for Pune businesses", text: "Daily housekeeping, deep cleaning and AMCs — quoted after a free site inspection.", cta: "Request Site Inspection", service: "Commercial Services", inspection: true, position: "36% 30%" },
  { src: "/marketing/carousel-equipment.webp", alt: "Sahara technician using an upholstery extraction machine on a sofa", eyebrow: "Individual services", title: "Just the kitchen, bathroom or sofa? We do that too", text: "Kitchen degreasing, bathroom descaling, sofa and carpet shampooing at fixed rates.", cta: "Book a Service", service: "Individual Services" },
  { src: "/marketing/service-painting.webp", alt: "Sahara painters rolling and taping a living-room wall in Pune", eyebrow: "Painting & pest control", title: "Painting and pest control with a written quote first", text: "Asian Paints range and targeted pest treatments, planned after inspection.", cta: "Book Free Inspection", service: "Painting / Pest Control", inspection: true },
  { src: "/marketing/carousel-team.webp", alt: "Sahara cleaning team deep cleaning a living room in Pune", eyebrow: "Relocation & property", title: "Moving home? Shifting, agreements and snagging sorted", text: "Packers & movers, rent agreement with police verification, and property snagging.", cta: "Get a Quote", service: "Relocation & Property Services", inspection: true },
];

const HUBS = ["magarpatta", "kharadi", "wakad", "baner", "hinjewadi", "mohammadwadi", "pcmc"];

/**
 * Public homepage (owner rebuild 2026-11-02). Hero slider → 4-category grid → fixed BHK rate cards → combo packages →
 * on-inspection explainer (B2B & custom) → before/after work → about & Google rating → reviews → partner marquee →
 * Pune/PCMC area hubs → branches → FAQ. Every Book button opens the one lead modal mounted by LandingShell.
 * Layout model: BOXED (max-w-6xl) throughout; full-bleed only for the hero slider.
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
  const hubs = HUBS.map((s) => PUNE_AREAS.find((a) => a.slug === s)).filter((a): a is NonNullable<typeof a> => !!a);
  return (
    <LandingShell logoUrl={settings?.logoUrl} waText={WA} jsonLd={[businessJsonLd(magarpattaBranchExtra()), ...branchGraph(), faqJsonLd(HOME_FAQS)]}>
      <HomeHeroSlider slides={SLIDES} callNumber={BRANCHES.magarpatta.phone} waHref={waLink(WA, BRANCHES.magarpatta.whatsapp)} rating={settings?.googleRating || TRUST.rating} reviews={TRUST.siteReviewLabel} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:space-y-10 sm:py-10">
        <CategoryGrid />
        <div className="space-y-3">
          <h2 className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Full house deep cleaning — fixed rates</h2>
          <HomeBhkPriceCards />
        </div>
        <ComboPackages />
        <InspectionFlow service="Commercial / Custom site inspection" title="Commercial, painting, post-construction & relocation — quoted on inspection" />
        <WorkGallery fallback={[
          { src: "/marketing/carousel-result.webp", alt: "Living room after Sahara deep cleaning" },
          { src: "/marketing/hero-commercial-v2.webp", alt: "Office cleaned by Sahara" },
          { src: "/marketing/service-painting.webp", alt: "Wall painting by Sahara" },
          { src: "/marketing/service-pest-control.webp", alt: "Pest control treatment by Sahara" },
        ]} />
        <HomeAbout reviewUrl={reviewUrl} rating={settings?.googleRating || undefined} />
        {reviews.length > 0 && <ReviewsCarousel reviews={reviews} reviewUrl={reviewUrl} />}
        <PartnersMarquee />

        <section aria-labelledby="areas-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <h2 id="areas-title" className="text-2xl font-extrabold text-[#0a2540]">Serving Pune & PCMC</h2>
          <p className="mt-1 text-[#0a2540]/70">Societies, IT parks, architects, builders and restaurants — pick your area.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {hubs.map((a) => (
              <li key={a.slug}><Link href={`/pune/${a.slug}`} className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-[#0a2540]/10 px-4 py-2.5 text-sm font-semibold text-[#0a2540] hover:border-primary hover:text-primary"><span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" />{a.name}</span><ArrowRight className="size-4 shrink-0" /></Link></li>
            ))}
            <li><Link href="/pune" className="flex min-h-14 items-center justify-between gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">All Pune areas<ArrowRight className="size-4" /></Link></li>
          </ul>
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
