import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck, ClipboardCheck, FileText, Home, MapPin, MapPinned, Phone, Sparkles, Star, Truck } from "lucide-react";
import { CATALOG_CATEGORIES, INSPECTION_STEPS, servicesIn, servicePath, type CatalogService } from "@/config/service-catalog";
import { getPublicPricing } from "@/server/pricing";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { liveCombos } from "@/lib/marketing-content";
import { CLIENT_LOGOS } from "@/lib/client-logos";
import { ClientCarousel } from "@/components/ui/client-carousel";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { LeadButton } from "@/components/public/lead-button";
import { HomeBhkPriceCards } from "@/components/public/landing-kit";
import { BRANCHES, LOCALITIES, ZONES, seoPagePath, type ZoneKey } from "@/config/pune-seo-matrix";
import { FcGoogle } from "react-icons/fc";
import { TRUST } from "@/lib/booking-target";
import { CLIENT_NAMES } from "@/lib/client-logos";

// Server building blocks for the rebuilt public site (2026-11-02). All prices come from the live pricing master; nothing
// here invents a price, a client or a review. Layout model: BOXED (max-w-6xl) cards with rounded corners throughout.

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ICON = { residential: Home, individual: Sparkles, commercial: Building2, relocation: Truck } as const;

/** Homepage 4-category grid: photo, short blurb and every service in the category as a link. */
export function CategoryGrid() {
  return (
    <section id="services" aria-labelledby="cat-title" className="scroll-mt-28">
      <h2 id="cat-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">What can we do for you?</h2>
      <p className="mt-1 text-[#0a2540]/70">Four service lines, one trained in-house team.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATALOG_CATEGORIES.map((c) => {
          const Icon = ICON[c.id];
          const items = servicesIn(c.id);
          return (
            <article key={c.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#0a2540]/5">
              <div className="relative aspect-[16/10]">
                <Image src={c.image} alt={c.label} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" loading="lazy" className="object-cover" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-primary"><Icon className="size-3.5" />{c.short}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-lg font-extrabold text-[#0a2540]">{c.label}</h3>
                <p className="mt-0.5 text-sm text-[#0a2540]/65">{c.blurb}</p>
                <ul className="mt-3 space-y-1">
                  {items.map((s) => (
                    <li key={s.slug}><Link href={servicePath(s.slug)} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0a2540] hover:bg-[#eef4fb] hover:text-primary">{s.name}<ArrowRight className="size-3.5 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></Link></li>
                  ))}
                </ul>
                <LeadButton intent={{ service: c.label, inspection: c.id === "commercial" || c.id === "relocation" }} className="mt-auto min-h-11 rounded-xl bg-primary text-sm font-bold text-white">{c.id === "commercial" || c.id === "relocation" ? "Request Site Inspection" : "Book Now"}</LeadButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const STEP_ICON = [ClipboardCheck, MapPinned, FileText, CalendarCheck];

/** "Request Site Inspection / Quote" block with the 4-step explainer — used for every on-inspection service. */
export function InspectionFlow({ service, title = "Price after a free site inspection" }: { service: string; title?: string }) {
  return (
    <section id="book" aria-labelledby="insp-title" className="scroll-mt-28 rounded-3xl bg-[#0a2540] p-5 text-white sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-wide text-amber-300">On-inspection pricing</p>
      <h2 id="insp-title" className="mt-1 text-2xl font-extrabold">{title}</h2>
      <p className="mt-1 max-w-2xl text-white/75">Every site is different, so we never guess a price. A supervisor checks the scope first and you get a written quotation — no obligation.</p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INSPECTION_STEPS.map((s, n) => {
          const Icon = STEP_ICON[n];
          return (
            <li key={s.title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <p className="flex items-center gap-2 text-sm font-extrabold"><span className="flex size-7 items-center justify-center rounded-full bg-amber-400 text-[#0a2540]">{n + 1}</span><Icon className="size-4 text-amber-300" />{s.title}</p>
              <p className="mt-2 text-sm text-white/75">{s.body}</p>
            </li>
          );
        })}
      </ol>
      <LeadButton intent={{ service, inspection: true }} className="mt-5 min-h-12 rounded-xl bg-amber-400 px-6 text-sm font-extrabold text-[#0a2540] hover:bg-amber-300">Request Site Inspection / Quote</LeadButton>
    </section>
  );
}

/** "Starting from" rate cards for quantity-priced individual services, read live from the pricing master. */
export async function FromPriceCards({ service }: { service: CatalogService }) {
  const pricing = await getPublicPricing();
  const items = (service.pricing.contentIds ?? []).map((id) => pricing.items.find((i) => i.contentId === id)).filter((i): i is NonNullable<typeof i> => !!i);
  if (items.length === 0) return <InspectionFlow service={service.name} title="Price confirmed before booking" />;
  return (
    <section id="book" aria-labelledby="from-title" className="scroll-mt-28 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="from-title" className="text-xl font-extrabold text-[#0a2540]">Transparent rates</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <article key={i.contentId} className="flex flex-col rounded-2xl border border-[#0a2540]/10 bg-[#eef4fb] p-4">
            <p className="font-extrabold text-[#0a2540]">{i.name}</p>
            <p className="mt-1 text-3xl font-extrabold text-[#0a2540]">{i.price != null ? inr(i.price) : <span className="text-lg">{i.priceNote ?? "Price confirmed before booking"}</span>}{i.price != null && i.unit && <span className="ml-1 text-sm font-semibold text-[#0a2540]/60">{i.unit}</span>}</p>
            {(i.rule || i.scope) && <p className="mt-1 text-xs text-[#0a2540]/65">{[i.rule, i.scope].filter(Boolean).join(" · ")}</p>}
            <LeadButton intent={{ service: service.name, pkg: i.name, price: i.price != null && i.minQty ? i.price * i.minQty : i.price }} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Now</LeadButton>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[#0a2540]/60">Rates include GST-billed service by our in-house crew. Minimum quantities apply as shown.</p>
    </section>
  );
}

/** The price block for a service page: BHK cards, starting rates or the inspection flow. */
export async function ServicePricing({ service }: { service: CatalogService }) {
  if (service.pricing.mode === "bhk") return <div id="book" className="scroll-mt-28"><HomeBhkPriceCards /></div>;
  if (service.pricing.mode === "from") return <FromPriceCards service={service} />;
  return <InspectionFlow service={service.name} />;
}

/** Combo packages from the pricing master (owner-approved 2026-11-02). */
export async function ComboPackages() {
  const pricing = await getPublicPricing();
  const combos = liveCombos(pricing.items).filter((c) => !/add-on only/i.test(c.note));
  if (combos.length === 0) return null;
  return (
    <section aria-labelledby="combo-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="combo-title" className="text-2xl font-extrabold text-[#0a2540]">Combo packages</h2>
      <p className="mt-1 text-sm text-[#0a2540]/65">Fixed-price bundles for the areas that need it most.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((c) => (
          <article key={c.name} className="flex flex-col rounded-2xl border border-[#0a2540]/10 bg-[#eef4fb] p-4">
            <p className="font-extrabold text-[#0a2540]">{c.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">{inr(c.price)}</p>
            {c.note && <p className="mt-1 text-xs text-[#0a2540]/65">{c.note}</p>}
            <LeadButton intent={{ service: "Combo Package", pkg: c.name, price: c.price }} className="mt-4 min-h-11 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Combo</LeadButton>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Before/after showcase. Real job photos from the CRM gallery (Settings → Gallery, featured items) filtered by the service's
 * gallery category; until the owner uploads pairs for a category, the service's own work photos are shown instead.
 */
export async function WorkGallery({ category, fallback, title = "Before & after — our work" }: { category?: string; fallback: { src: string; alt: string }[]; title?: string }) {
  const items = await getFeaturedGallery(12, category);
  return (
    <section aria-labelledby="work-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="work-title" className="text-2xl font-extrabold text-[#0a2540]">{title}</h2>
        <Link href="/gallery" className="text-sm font-bold text-primary">See all work →</Link>
      </div>
      <div className="mt-4">
        {items.length > 0 ? (
          <BeforeAfterGallery items={items} heading={false} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {fallback.map((f) => (
              <figure key={f.src} className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image src={f.src} alt={f.alt} fill sizes="(min-width:1024px) 25vw, 50vw" loading="lazy" className="object-cover" />
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const SEGMENTS = ["IT parks & corporate offices", "Co-operative housing societies", "Architects & interior designers", "Builders & developers", "Restaurants & cloud kitchens", "Showrooms & retail", "Hospitals & clinics", "Warehouses & industrial units"];

/** "Trusted Corporate & Society Partners" marquee: client logos once they are added (src/lib/client-logos.ts), else the segments we serve. */
export function PartnersMarquee() {
  if (CLIENT_LOGOS.length > 0) return <ClientCarousel logos={CLIENT_LOGOS} title="Trusted Corporate & Society Partners" />;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {SEGMENTS.map((s) => <li key={`${hidden}-${s}`} className="whitespace-nowrap rounded-full bg-[#eef4fb] px-4 py-2 text-sm font-bold text-[#0a2540]">{s}</li>)}
    </ul>
  );
  return (
    <section aria-labelledby="partners-title" className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm">
      <h2 id="partners-title" className="text-center text-lg font-extrabold text-[#0a2540]">Trusted Corporate & Society Partners</h2>
      <div className="mt-3 flex w-max sahara-marquee">{row(false)}{row(true)}</div>
    </section>
  );
}

/**
 * Horizontal combo swiper (owner 2026-11-02): all combo packages in one right-to-left, touch-swipeable row (CSS scroll-snap, no JS),
 * so combos never add vertical page length.
 */
export async function ComboSwiper() {
  const pricing = await getPublicPricing();
  const combos = liveCombos(pricing.items).filter((c) => !/add-on only/i.test(c.note));
  if (combos.length === 0) return null;
  return (
    <section aria-labelledby="combo-title">
      <div className="flex items-end justify-between gap-2">
        <h2 id="combo-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Combo packages</h2>
        <p className="text-xs font-semibold text-[#0a2540]/55">Swipe →</p>
      </div>
      <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {combos.map((c) => (
          <li key={c.name} className="flex w-[78%] shrink-0 snap-start flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#0a2540]/5 sm:w-[44%] lg:w-[31%]">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Combo</p>
            <p className="mt-0.5 font-extrabold leading-snug text-[#0a2540]">{c.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">{inr(c.price)}</p>
            {c.note && <p className="mt-1 text-xs text-[#0a2540]/65">{c.note}</p>}
            <LeadButton intent={{ service: "Combo Package", pkg: c.name, price: c.price }} className="mt-3 min-h-11 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Combo</LeadButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Official Google rating badge, directly under the hero (owner 2026-11-02). */
export function GoogleRatingBadge({ reviewUrl, rating = TRUST.rating }: { reviewUrl: string; rating?: string }) {
  return (
    <a href={reviewUrl} target="_blank" rel="noopener noreferrer" aria-label={`${TRUST.siteReviewLabel} Google reviews, rated ${rating} out of 5`} className="mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-md ring-1 ring-[#0a2540]/5">
      <FcGoogle className="size-8 shrink-0" aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-lg font-extrabold text-[#0a2540]">{rating}<span className="flex" aria-hidden>{[0, 1, 2, 3, 4].map((n) => <Star key={n} className="size-4 fill-amber-400 text-amber-400" />)}</span></span>
        <span className="text-xs font-semibold text-[#0a2540]/65">{TRUST.siteReviewLabel} Google Reviews</span>
      </span>
    </a>
  );
}

/** Verified-client marquee: logo files when added (CLIENT_LOGOS), otherwise the approved client names as wordmarks. */
export function ClientMarquee() {
  if (CLIENT_LOGOS.length > 0) return <ClientCarousel logos={CLIENT_LOGOS} title="Trusted by" />;
  const base = Array.from({ length: 3 }, () => CLIENT_NAMES).flat();
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {base.map((n, i) => <li key={`${hidden}-${i}`} className="whitespace-nowrap text-lg font-black uppercase tracking-wide text-[#0a2540]/55">{n}</li>)}
    </ul>
  );
  return (
    <section aria-label="Trusted by" className="overflow-hidden">
      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-[#0a2540]/50">Trusted by</p>
      <div className="mt-2 flex w-max sahara-marquee">{row(false)}{row(true)}</div>
    </section>
  );
}

/** Clean branch details (owner 2026-11-02): address and tap-to-call only — no map / review buttons. */
export function BranchDetails() {
  const list = [
    { name: "Magarpatta Branch", address: "Opposite South Gate, Magarpatta City, Hadapsar, Pune - 411028", phones: [BRANCHES.magarpatta.phone] },
    { name: "Mohammadwadi Branch", address: `${BRANCHES.mohammadwadi.streetAddress}, Pune - ${BRANCHES.mohammadwadi.postalCode}`, phones: [BRANCHES.mohammadwadi.phone, ...BRANCHES.mohammadwadi.altPhones] },
  ];
  return (
    <section aria-labelledby="branches-title">
      <h2 id="branches-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Our branches</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {list.map((b) => (
          <article key={b.name} className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-extrabold text-[#0a2540]">{b.name}</h3>
            <p className="mt-1 flex gap-1.5 text-sm text-[#0a2540]/75"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{b.address}</p>
            <p className="mt-3 flex flex-wrap gap-2">
              {b.phones.map((n) => <a key={n} href={`tel:+91${n}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-sm font-bold text-primary"><Phone className="size-3.5" />+91-{n}</a>)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Service-area zonal table (owner 2026-11-02): replaces the scattered area tag lists on /services/<slug> pages with one collapsible
 * section per Pune zone. Every locality link stays in the HTML (<details> content is crawlable), so local-SEO internal links are kept.
 */
export function ZoneAccordion({ seoSlug, service }: { seoSlug: string; service: string }) {
  const zones = Object.keys(ZONES) as ZoneKey[];
  return (
    <section aria-labelledby="zones-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="zones-title" className="text-xl font-extrabold text-[#0a2540]">{service} across Pune</h2>
      <div className="mt-3 divide-y divide-[#0a2540]/10 rounded-2xl ring-1 ring-[#0a2540]/10">
        {zones.map((z, n) => {
          const locs = LOCALITIES.filter((l) => l.zone === z);
          return (
            <details key={z} open={n === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-[#0a2540] [&::-webkit-details-marker]:hidden">
                <span>{ZONES[z].label} <span className="ml-1 font-semibold text-[#0a2540]/50">({locs.length} areas)</span></span>
                <span className="text-primary transition group-open:rotate-90">›</span>
              </summary>
              <table className="w-full text-left text-sm">
                <thead className="sr-only"><tr><th>Area</th><th>PIN</th></tr></thead>
                <tbody>
                  {locs.map((l) => (
                    <tr key={l.slug} className="border-t border-[#0a2540]/5">
                      <td className="px-4 py-2"><Link href={seoPagePath(seoSlug, l.slug)} className="font-semibold text-primary hover:underline">{service} in {l.name}</Link></td>
                      <td className="px-4 py-2 text-right text-xs text-[#0a2540]/55">{l.pins.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </section>
  );
}
