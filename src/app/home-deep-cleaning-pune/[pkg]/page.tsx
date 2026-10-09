import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, RoomScope, QuoteSection, Faqs, Terms, OtherServices, BASE_URL, CAROUSEL, businessJsonLd, faqJsonLd, packageSlug } from "@/components/public/landing-kit";
import { activeCampaign, todayIST, unitPriceFor, type FestivalWindow, type PriceItem } from "@/lib/pricing-master";
import { getLivePricing } from "@/server/pricing";
import { inr } from "@/lib/marketing-content";
import { HOME_DURATION, homeHighlights, type HomeTier } from "@/lib/service-scope";

// One page per full-house package (1–4 BHK × Premium / Platinum) — the
// link target for ads, WhatsApp and Google Business services. Price comes
// only from the pricing master; scope from lib/service-scope.

export const dynamic = "force-dynamic";

const TIERS: HomeTier[] = ["Premium", "Platinum"];
const BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK"];

// While the festival campaign runs (`festival` set) the page shows the festival price only — no regular
// price, MRP or savings. Outside the campaign it shows the regular price as before.
function resolve(slug: string, items: PriceItem[], festival: FestivalWindow | null) {
  for (const bhk of BHKS) {
    for (const tier of TIERS) {
      if (packageSlug(bhk, tier) === slug) {
        const item = items.find((p) => p.bhk === bhk && p.variant === tier);
        const price = item ? (festival ? unitPriceFor(item, festival) : item.price) : null;
        if (item && price != null) return { bhk, tier, price, mrp: festival ? null : item.mrp ?? null };
      }
    }
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ pkg: string }> }): Promise<Metadata> {
  const live = await getLivePricing();
  const p = resolve((await params).pkg, live.items, activeCampaign(live.festivals, todayIST())?.current ?? null);
  if (!p) return {};
  const title = `${p.bhk} ${p.tier} Home Deep Cleaning in Pune – ${inr(p.price)} | Sahara Cleaning Services`;
  const description = `${p.bhk} ${p.tier} home deep cleaning in Pune & PCMC for ${inr(p.price)}: ${homeHighlights(p.tier).join(", ")}. Room-wise scope, terms and live available slots.`;
  const url = `${BASE_URL}/home-deep-cleaning-pune/${packageSlug(p.bhk, p.tier)}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images: [`${BASE_URL}/marketing/hero-home.webp`], type: "website" } };
}

export default async function HomePackagePage({ params }: { params: Promise<{ pkg: string }> }) {
  const { items, festivals } = await getLivePricing();
  const fest = activeCampaign(festivals, todayIST())?.current ?? null;
  const p = resolve((await params).pkg, items, fest);
  if (!p) notFound();
  const settings = await getCompanySettings();
  const other = p.tier === "Premium" ? "Platinum" : "Premium";
  const otherItem = items.find((x) => x.bhk === p.bhk && x.variant === other);
  const otherPrice = otherItem ? (fest ? unitPriceFor(otherItem, fest) : otherItem.price) : null;
  const WA = `Hi Sahara, I'd like to book ${p.bhk} ${p.tier} home deep cleaning.`;
  const FAQS = [
    { q: `What is included in ${p.bhk} ${p.tier}?`, a: `Complete home cleaning — rooms, kitchen, bathrooms and balcony — with ${p.tier === "Platinum" ? "wall wet cleaning" : "wall dry dusting"} and ceiling dry dusting. See the room-wise scope above.` },
    { q: "How long does it take?", a: `${HOME_DURATION}, depending on home size and condition.` },
    { q: "Do I need to arrange anything?", a: "Please keep adequate water and electricity supply, a suitable ladder where required, and access to all areas to be cleaned." },
    { q: "Is my booking confirmed when I submit?", a: "It's a booking request. Our team checks the slot and confirms it on WhatsApp with your booking link." },
  ];

  return (
    <LandingShell
      logoUrl={settings.logoUrl}
      waText={WA}
      jsonLd={[
        businessJsonLd({ makesOffer: [{ "@type": "Offer", name: `${p.bhk} ${p.tier} Home Deep Cleaning`, price: p.price, priceCurrency: "INR" }] }),
        faqJsonLd(FAQS),
      ]}
    >
      <Hero
        image="/marketing/hero-home.webp"
        alt={CAROUSEL.team.alt}
        title={`${p.bhk} ${p.tier} Home Deep Cleaning`}
        subtitle={`${inr(p.price)} · ${HOME_DURATION}. Room-wise scope, clear terms and live available slots.`}
        primaryLabel="Book Now"
        bookHrefOverride="#quote"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-8">
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0a2540]/55">Package price</p>
              <p className="text-3xl font-extrabold text-primary">{inr(p.price)}</p>
              {p.mrp && <p className="text-xs text-[#0a2540]/50">MRP <span className="line-through">{inr(p.mrp)}</span></p>}
            </div>
            <a href="#quote" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">Book Now</a>
          </div>
          <p className="mt-2 text-xs text-[#0a2540]/60">{HOME_DURATION} · Pune &amp; PCMC</p>
        </section>

        <section>
          <h2 className="text-xl font-bold">What&apos;s included</h2>
          <RoomScope tier={p.tier} />
          {otherPrice != null && (
            <Link href={`/home-deep-cleaning-pune/${packageSlug(p.bhk, other)}`} className="mt-3 block rounded-2xl border border-primary/30 bg-white p-3.5 text-sm">
              Compare <span className="font-bold">{p.bhk} {other}</span> — {other === "Platinum" ? "wall wet cleaning" : "wall dry dusting"} · <span className="font-bold text-primary">{inr(otherPrice)}</span> →
            </Link>
          )}
        </section>

        <QuoteSection title={`Book ${p.bhk} ${p.tier}`} subtitle="Pick an available date & time — our team confirms on WhatsApp." campaignName={`Home Deep Cleaning ${p.bhk} ${p.tier}`} preset={{ bhk: p.bhk, pkg: p.tier }} />
        <Faqs faqs={FAQS} />
        <Terms />
        <OtherServices current="/home-deep-cleaning-pune" />
        <p className="text-center text-sm"><Link href="/home-deep-cleaning-pune" className="font-semibold text-primary underline">All home deep cleaning packages →</Link></p>
      </main>
    </LandingShell>
  );
}
