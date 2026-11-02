import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck, ClipboardCheck, FileText, Home, MapPin, MapPinned, Phone, Sparkles, Star, Truck } from "lucide-react";
import { img } from "@/config/image-registry";
import { CATALOG_CATEGORIES, INSPECTION_STEPS, catalogServiceBySlug, categoryPath, excludesFor, servicesIn, servicePath, type CatalogService } from "@/config/service-catalog";
import { getPublicPricing } from "@/server/pricing";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { liveCombos, livePkgs, PREMIUM_SCOPE, PLATINUM_SCOPE, PREMIUM_EXCLUDED, PLATINUM_EXCLUDED } from "@/lib/marketing-content";
import { CLIENT_LOGOS } from "@/lib/client-logos";
import { ClientCarousel } from "@/components/ui/client-carousel";
import { BeforeAfterGallery } from "@/components/public/before-after-gallery";
import { LeadButton } from "@/components/public/lead-button";
import { buildHomeRows, festivalPriceNote } from "@/components/public/landing-kit";
import { PackageCalculator, PestCalculator, QtyCalculator, UnfurnishedCalculator, type QtyItem } from "@/components/public/rate-calculators";
import { PEST_BHK_RATES, PEST_BHK_SIZES, activeCampaign, comboSavings, todayIST, type PriceItem } from "@/lib/pricing-master";
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
                <h3 className="text-lg font-extrabold text-[#0a2540]"><Link href={categoryPath(c.id)} className="hover:text-primary">{c.label}</Link></h3>
                <p className="mt-0.5 text-sm text-[#0a2540]/65">{c.blurb}</p>
                <ul className="mt-3 space-y-1">
                  {items.map((s) => (
                    <li key={s.slug}><Link href={servicePath(s.slug)} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0a2540] hover:bg-[#eef4fb] hover:text-primary">{s.name}<ArrowRight className="size-3.5 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" /></Link></li>
                  ))}
                </ul>
                <LeadButton intent={{ service: c.label, inspection: c.id === "commercial" || c.id === "relocation", b2b: c.id === "commercial" }} className="mt-auto min-h-11 rounded-xl bg-primary text-sm font-bold text-white">{c.id === "commercial" || c.id === "relocation" ? "Request Site Inspection" : "Book Now"}</LeadButton>
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
export function InspectionFlow({ service, title = "Price after a free site inspection", b2b = false }: { service: string; title?: string; /** B2B funnel: the request becomes a free site audit (company, property, area). */ b2b?: boolean }) {
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
      <LeadButton intent={{ service, inspection: true, b2b }} className="mt-5 min-h-12 rounded-xl bg-amber-400 px-6 text-sm font-extrabold text-[#0a2540] hover:bg-amber-300">{b2b ? "Request Free Site Audit" : "Request Site Inspection / Quote"}</LeadButton>
    </section>
  );
}

/** Unfurnished tab scope (same lines as the Unfurnished Home Cleaning page). */
const UNFURNISHED_SCOPE = {
  included: catalogServiceBySlug("unfurnished-home-cleaning")?.includes ?? [],
  excluded: ["Furniture, sofa or mattress cleaning (nothing to clean in an empty flat)", "Inaccessible or unsafe heights", "Old permanent stains (no guarantee of full removal)"],
};

/**
 * The rate calculator for a landing page (owner R&D directive 2026-11-02):
 *   bhk  → PackageCalculator (property × occasion → Premium / Platinum with included / excluded),
 *   from → QtyCalculator (unit rate × quantity = live total),
 *   pest → PestCalculator (1–4 BHK flat rates per treatment),
 *   inspection → the free-inspection flow.
 */
export async function ServicePricing({ service }: { service: CatalogService }) {
  const pricing = await getPublicPricing();
  if (service.pricing.mode === "bhk") {
    const campaign = activeCampaign(pricing.festivals, todayIST());
    const rows = buildHomeRows(livePkgs(pricing.items, "PREMIUM", campaign?.current), livePkgs(pricing.items, "PLATINUM", campaign?.current));
    return (
      <PackageCalculator
        service={service.name}
        rows={rows.map((r) => ({ bhk: r.bhk, premium: r.premium, platinum: r.platinum, premiumId: pricing.items.find((i) => i.group === "PREMIUM" && i.bhk === r.bhk)?.contentId, platinumId: pricing.items.find((i) => i.group === "PLATINUM" && i.bhk === r.bhk)?.contentId }))}
        scope={{ Premium: { included: PREMIUM_SCOPE, excluded: PREMIUM_EXCLUDED }, Platinum: { included: PLATINUM_SCOPE, excluded: PLATINUM_EXCLUDED } }}
        note={festivalPriceNote(campaign)}
        defaultOccasion={service.slug === "move-in-move-out-cleaning" ? "Unfurnished" : "Regular"}
        unfurnished={pricing.items.filter((i) => i.group === "UNFURNISHED" && i.price != null && i.bhk).map((i) => ({ bhk: i.bhk!, price: i.price!, id: i.contentId }))}
        unfurnishedScope={UNFURNISHED_SCOPE}
      />
    );
  }
  if (service.pricing.mode === "unfurnished") {
    const rows = pricing.items.filter((i) => i.group === "UNFURNISHED" && i.price != null && i.bhk).map((i) => ({ bhk: i.bhk!, price: i.price!, id: i.contentId }));
    if (rows.length === 0) return <InspectionFlow service={service.name} />;
    return <UnfurnishedCalculator rows={rows} />;
  }
  if (service.pricing.mode === "from") {
    const items = (service.pricing.contentIds ?? []).map((id) => pricing.items.find((i) => i.contentId === id)).filter((i): i is NonNullable<typeof i> => !!i);
    if (items.length === 0) return <InspectionFlow service={service.name} title="Price confirmed before booking" />;
    return <QtyCalculator service={service.name} items={items.map(toQty)} note="Minimum quantities apply as shown." />;
  }
  if (service.pricing.mode === "pest") return <PestCalculator rows={PEST_BHK_RATES.map((r, n) => ({ ...r, image: PEST_IMAGES[n % PEST_IMAGES.length] }))} sizes={PEST_BHK_SIZES} note="Flat rates for apartments." />;
  return <InspectionFlow service={service.name} b2b={service.category === "commercial"} />;
}

// Pest treatment cards, in PEST_BHK_RATES order: cockroach & ant, bed bug, rodent, termite, mosquito (image registry).
const PEST_IMAGES = [img("pest").src, img("pest-backpack").src, img("pest-rodent").src, img("pest-termite").src, img("pest-drain").src];

const toQty = (i: PriceItem): QtyItem => ({ id: i.contentId, name: i.name, price: i.price, unit: i.unit, minQty: i.minQty, rule: [i.rule, i.scope].filter(Boolean).join(" · ") || undefined, priceNote: i.priceNote });

/** Every individual-service rate in one calculator — for the Individual Services category page. */
export async function IndividualRates() {
  const pricing = await getPublicPricing();
  const items = servicesIn("individual").flatMap((s) => (s.pricing.contentIds ?? []).map((id) => pricing.items.find((i) => i.contentId === id))).filter((i): i is NonNullable<typeof i> => !!i);
  const unique = items.filter((i, n) => items.findIndex((x) => x.contentId === i.contentId) === n);
  return <QtyCalculator service="Individual Services" items={unique.map(toQty)} note="Minimum quantities apply as shown." heading="Individual service rates" />;
}

/** Full scope of work: what's included · not included (owner 2026-11-02: no GST blocks on inner pages). */
export function ScopeOfWork({ service }: { service: CatalogService }) {
  const home = service.pricing.mode === "bhk";
  return (
    <section aria-labelledby="sow-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="sow-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Scope of work</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-sm font-extrabold text-emerald-800">What&apos;s included</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[#0a2540]/85">{(home ? PREMIUM_SCOPE : service.includes).map((i) => <li key={i} className="flex gap-1.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-600" />{i}</li>)}</ul>
          {home && <p className="mt-2 text-xs font-semibold text-emerald-800">Platinum adds wall wet cleaning.</p>}
        </div>
        <div className="rounded-2xl bg-red-50 p-4">
          <p className="text-sm font-extrabold text-red-800">Not included</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[#0a2540]/80">{(home ? PREMIUM_EXCLUDED : excludesFor(service)).map((i) => <li key={i} className="flex gap-1.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" />{i}</li>)}</ul>
        </div>
      </div>
      <Link href="/scope-of-work" className="mt-3 inline-block text-sm font-bold text-primary">Full scope of work →</Link>
    </section>
  );
}

/** Category landing page body: every service in the category as a card (rate badge → its own landing page). */
export async function CategoryServiceCards({ id, anchor }: { id: CatalogService["category"]; /** Render as the page's #book target. */ anchor?: boolean }) {
  const pricing = await getPublicPricing();
  return (
    <section id={anchor ? "book" : undefined} aria-labelledby="cat-svc-title" className="scroll-mt-24">
      <h2 id="cat-svc-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Choose a service</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {servicesIn(id).map((s) => {
          const orders = (s.pricing.contentIds ?? []).map((cid) => pricing.items.find((i) => i.contentId === cid)).filter((i) => i?.price != null).map((i) => i!.price! * Math.max(1, i!.minQty ?? 1));
          const first = orders.length ? Math.min(...orders) : null;
          const badge = s.pricing.mode === "inspection" ? "Free site inspection" : s.pricing.mode === "pest" ? `From ${inr(PEST_BHK_RATES[0].rates["1 BHK"])}` : s.pricing.mode === "bhk" ? "Fixed BHK rates" : s.pricing.mode === "unfurnished" ? "Fixed BHK rates" : first != null ? `From ${inr(first)}` : "Price on confirmation";
          return (
            <li key={s.slug}>
              <Link href={servicePath(s.slug)} className="group flex h-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#0a2540]/5 hover:ring-2 hover:ring-primary">
                <span className="relative block w-28 shrink-0 sm:w-32"><Image src={s.image} alt={s.imageAlt} fill sizes="128px" loading="lazy" className="object-cover" /></span>
                <span className="flex min-w-0 flex-col p-3.5">
                  <span className="font-extrabold leading-snug text-[#0a2540]">{s.name}</span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-[#0a2540]/65">{s.blurb}</span>
                  <span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[11px] font-extrabold ${s.pricing.mode === "inspection" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{badge}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
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
export async function WorkGallery({ category, fallback, title = "Before & after — our work", onlyReal = false }: { category?: string; fallback: { src: string; alt: string }[]; title?: string; /** Render nothing until real gallery items exist. */ onlyReal?: boolean }) {
  const items = await getFeaturedGallery(12, category);
  if (onlyReal && items.length === 0) return null;
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
  const combos = pricing.items.filter((i) => i.group === "COMBO" && !i.addOnOnly && i.price != null).map((i) => ({ id: i.contentId, name: i.name, price: i.price!, note: i.rule ?? "" }));
  if (combos.length === 0) return null;
  return (
    <section aria-labelledby="combo-title">
      <div className="flex items-end justify-between gap-2">
        <h2 id="combo-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Combo packages</h2>
        <p className="text-xs font-semibold text-[#0a2540]/70">Swipe →</p>
      </div>
      <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {combos.map((c) => (
          <li key={c.name} className="flex w-[78%] shrink-0 snap-start flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#0a2540]/5 sm:w-[44%] lg:w-[31%]">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Combo</p>
            <p className="mt-0.5 font-extrabold leading-snug text-[#0a2540]">{c.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">{inr(c.price)}</p>
            {c.note && <p className="mt-1 text-xs text-[#0a2540]/65">{c.note}</p>}
            <LeadButton intent={{ service: "Combo Package", pkg: c.name, price: c.price, category: "INDIVIDUAL_CLEANING", items: [{ contentId: c.id, qty: 1 }], packageName: c.name }} className="mt-3 min-h-11 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Combo</LeadButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Official Google rating badge, directly under the hero (owner 2026-11-02). */
export function GoogleRatingBadge({ reviewUrl, rating = TRUST.rating, compact = false }: { reviewUrl: string; rating?: string; compact?: boolean }) {
  return (
    <a href={reviewUrl} target="_blank" rel="noopener noreferrer" aria-label={`${TRUST.siteReviewLabel} Google reviews, rated ${rating} out of 5`} className={compact ? "mx-auto inline-flex items-center gap-2.5 rounded-full bg-[#f5f8fd] px-4 py-2 ring-1 ring-[#0a2540]/10" : "mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-md ring-1 ring-[#0a2540]/5"}>
      <FcGoogle className="size-8 shrink-0" aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-lg font-extrabold text-[#0a2540]">{rating}<span className="flex" aria-hidden>{[0, 1, 2, 3, 4].map((n) => <Star key={n} className="size-4 fill-amber-400 text-amber-400" />)}</span></span>
        <span className="text-xs font-semibold text-[#0a2540]/65">{TRUST.siteReviewLabel} Google Reviews</span>
      </span>
    </a>
  );
}

/**
 * "Trusted by" client marquee under the Google rating: the clients' own logo files once added (CLIENT_LOGOS), otherwise the official
 * client names as clean wordmark tiles. Pure CSS loop (GPU transform), paused on hover, off for reduced-motion visitors.
 */
export function ClientMarquee() {
  // Owner 2026-11-03: one unified strip — each client shows its transparent PNG logo (public/clients, made by
  // scripts/convert-client-logos.py) as soon as it is added to CLIENT_LOGOS; until then its name tile.
  const logoFor = (n: string) => CLIENT_LOGOS.find((l) => l.name.toLowerCase() === n.toLowerCase());
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {CLIENT_NAMES.map((n) => {
        const logo = logoFor(n);
        return (
          <li key={`${hidden}-${n}`} className="flex h-14 min-w-[150px] items-center justify-center rounded-2xl bg-white px-5 shadow-sm ring-1 ring-[#0a2540]/5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny static PNGs; next/image adds nothing here
              <img src={logo.src} alt={hidden ? "" : n} loading="lazy" decoding="async" className="h-9 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="whitespace-nowrap text-[15px] font-black uppercase tracking-wide text-[#0a2540]/70">{n}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <section aria-label="Trusted by" className="overflow-hidden">
      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-[#0a2540]/70">Trusted by</p>
      <div className="mt-2 flex w-max sahara-marquee py-1">{row(false)}{row(true)}</div>
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
export function ZoneAccordion({ seoSlug, service }: { /** pune-seo-matrix category with area pages; omitted → area names without links. */ seoSlug?: string; service: string }) {
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
                <thead className="sr-only"><tr><th>Area</th></tr></thead>
                <tbody>
                  {locs.map((l) => (
                    <tr key={l.slug} className="border-t border-[#0a2540]/5">
                      <td className="px-4 py-2">{seoSlug ? <Link href={seoPagePath(seoSlug, l.slug)} className="font-semibold text-primary hover:underline">{service} in {l.name}</Link> : <span className="font-semibold text-[#0a2540]">{service} in {l.name}</span>}</td>
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

/** Homepage "4 main visual cards" — each one opens its dedicated landing page (owner 2026-11-02). Server-rendered links, no JS. */
export function HomeServiceCards() {
  const cards = [
    { href: servicePath("home-deep-cleaning"), title: "Full House Deep Cleaning", sub: "1–4 BHK, villas, move-in/out, post-construction", img: img("full-home").src, alt: img("full-home").alt },
    { href: categoryPath("individual"), title: "Individual Services", sub: "Kitchen, bathroom, sofa, carpet, windows", img: img("express").src, alt: img("express").alt },
    { href: servicePath("interior-painting"), title: "Interior Painting", sub: "Free site inspection & written quote", img: img("painting").src, alt: img("painting").alt },
    { href: servicePath("pest-control"), title: "Pest Control", sub: "Cockroach, bed bug, rodent, termite, mosquito", img: img("pest").src, alt: img("pest").alt },
  ];
  return (
    <section id="services" aria-labelledby="svc-title" className="scroll-mt-20">
      <h2 id="svc-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Our services</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#0a2540]/5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="relative block aspect-[4/3] w-full">
                <Image src={c.img} alt={c.alt} fill sizes="(min-width:1024px) 25vw, 50vw" loading="lazy" className="object-cover transition duration-500 group-hover:scale-105" />
              </span>
              <span className="flex flex-1 flex-col p-3 sm:p-4">
                <span className="text-[15px] font-extrabold leading-snug text-[#0a2540] sm:text-lg">{c.title}</span>
                <span className="mt-0.5 hidden text-sm text-[#0a2540]/65 sm:block">{c.sub}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">Explore<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Homepage zonal local-SEO grid (owner 2026-11-02): the four Pune zones with their localities — no PIN codes. */
export function ZoneGrid() {
  const zones = Object.keys(ZONES) as ZoneKey[];
  return (
    <section aria-labelledby="zone-grid-title">
      <h2 id="zone-grid-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Serving all of Pune</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {zones.map((z) => (
          <div key={z} className="rounded-3xl bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-base font-extrabold text-[#0a2540]"><MapPin className="size-4 text-primary" aria-hidden />{ZONES[z].label}</h3>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              {LOCALITIES.filter((l) => l.zone === z).map((l) => <li key={l.slug}><Link href={seoPagePath("home-deep-cleaning", l.slug)} className="inline-block py-1.5 text-[#0a2540]/80 hover:text-primary">{l.name}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Dynamic up-sell banner (final sprint 2026-11-02): single service vs combo package, computed from live prices. A combo is only
 * shown when it really costs less than booking the same items separately — no invented savings.
 */
export async function ComboUpsell({ contentIds }: { contentIds?: string[] }) {
  const pricing = await getPublicPricing();
  const deals = comboSavings(pricing.items, contentIds ?? []).slice(0, 2);
  if (deals.length === 0) return null;
  return (
    <section aria-labelledby="upsell-title" className="rounded-3xl bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm ring-1 ring-amber-200 sm:p-6">
      <h2 id="upsell-title" className="text-lg font-extrabold text-[#0a2540] sm:text-xl">Save with a combo</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {deals.map((d) => (
          <div key={d.combo.contentId} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-extrabold text-[#0a2540]">{d.combo.name}</p>
            <p className="mt-1 text-xs text-[#0a2540]/65">{d.parts.join(" · ")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-xl bg-[#f5f8fd] p-2"><p className="text-[11px] font-bold uppercase text-[#0a2540]/50">Booked separately</p><p className="font-extrabold text-[#0a2540]/60 line-through">{inr(d.separate)}</p></div>
              <div className="rounded-xl bg-emerald-50 p-2"><p className="text-[11px] font-bold uppercase text-emerald-700">Combo</p><p className="font-extrabold text-emerald-800">{inr(d.combo.price!)}</p></div>
            </div>
            <p className="mt-2 text-xs font-bold text-emerald-700">You save {inr(d.saving)}</p>
            <LeadButton intent={{ service: d.combo.name, pkg: "Combo", price: d.combo.price!, category: "INDIVIDUAL_CLEANING", items: [{ contentId: d.combo.contentId, qty: 1 }], packageName: d.combo.name }} className="mt-3 min-h-12 rounded-xl bg-primary text-sm font-bold text-white">Book combo · {inr(d.combo.price!)}</LeadButton>
          </div>
        ))}
      </div>
    </section>
  );
}
