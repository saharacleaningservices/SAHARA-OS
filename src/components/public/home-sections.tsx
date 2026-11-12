import { CalendarClock, HeartHandshake, Hourglass, Users } from "lucide-react";
import { getFeaturedGallery } from "@/server/actions/gallery";
import { toBeforeAfterPairs } from "@/lib/gallery";
import { BeforeAfterSlider } from "@/components/public/before-after-slider";
import { TRUST } from "@/lib/booking-target";
import { beforeAfterPairsFor, type SlideFolder } from "@/config/service-slides";

/**
 * Homepage sections added 2026-11-03: About Us stats grid, the text-only expansion banner and the Real Work before / after showcase.
 * Layout model: BOXED (inside the page's max-w-6xl column). All three are server components — no client JS except the existing slider.
 */

/** Four owner-supplied figures. 2x2 on phones, 1x4 from lg. */
export const ABOUT_STATS = [
  { icon: CalendarClock, label: "Established", value: String(TRUST.since), sub: `Since ${TRUST.since}` },
  { icon: HeartHandshake, label: "Customers Served", value: "8,000+", sub: "Homes & Offices" },
  { icon: Hourglass, label: "Combined Expertise", value: "25+ Years", sub: "Industry experience" },
  { icon: Users, label: "Professional Team", value: "20+", sub: "In-House Crew" },
] as const;

export function AboutStats() {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3" aria-label="Sahara at a glance">
      {ABOUT_STATS.map(({ icon: Icon, label, value, sub }) => (
        <li key={label} className="rounded-2xl bg-[#eef4fb] p-3 text-center sm:p-4">
          <Icon className="mx-auto size-6 text-primary" aria-hidden />
          <p className="mt-1 text-2xl font-extrabold leading-tight text-[#0a2540]">{value}</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">{label}</p>
          <p className="text-[11px] text-[#0a2540]/70">{sub}</p>
        </li>
      ))}
    </ul>
  );
}

/** Text-only banner, directly under About Us. Opacity-only pulse (compositor); honours reduced-motion. */
export function ExpansionBanner() {
  return (
    <section aria-label="Our expansion journey" className="rounded-3xl bg-[#0a2540] px-5 py-6 text-center shadow-sm sm:py-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300 sm:text-sm">Our Expansion Journey</p>
      <p className="sahara-fade-pulse mt-2 text-xl font-black uppercase leading-snug tracking-wide text-white sm:text-3xl">Coming soon to Mumbai &amp; Bangalore</p>
      <p className="mt-3 text-sm font-semibold text-white/85 sm:text-base">Currently serving in Pune and PCMC. Coming soon Mumbai and Bangalore.</p>
    </section>
  );
}

/** Which gallery categories the showcase draws from (owner: kitchen degreasing, tile scrubbing, sofa shampooing). */
export const SHOWCASE_CATEGORIES = ["Kitchen & Bathroom", "Sofa & Carpet", "Home Deep Cleaning"] as const;

/**
 * Real Work showcase: only genuine before / after pairs the office has marked Featured in the CRM gallery (never stock or generated
 * images). Draggable comparison sliders; horizontal swipe on phones, 3 columns from lg. Renders nothing until a pair exists.
 */
export async function RealWorkShowcase() {
  const items = await getFeaturedGallery(60);
  const pairs = toBeforeAfterPairs(items.filter((i) => !i.category || (SHOWCASE_CATEGORIES as readonly string[]).includes(i.category))).slice(0, 6);
  if (pairs.length === 0) return null;
  return (
    <section aria-labelledby="realwork-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Real work</p>
      <h2 id="realwork-title" className="mt-1 text-xl font-extrabold text-[#0a2540] sm:text-2xl">Before &amp; after — real Sahara jobs</h2>
      <p className="mt-1 text-sm text-[#0a2540]/70">Kitchen degreasing, tile scrubbing, sofa shampooing. Drag the handle to compare.</p>
      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible">
        {pairs.map((p, n) => (
          <div key={n} className="w-[85%] shrink-0 snap-center sm:w-[60%] lg:w-auto">
            <BeforeAfterSlider before={p.before!.url} after={p.after!.url} alt={(p.caption ?? p.category ?? "").trim() || "Sahara cleaning job"} caption={p.caption ?? p.category} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Folder order for the homepage: the services customers book most come first. */
const FEATURED_FOLDERS: SlideFolder[] = ["home", "kitchen", "bathroom", "sofa", "carpet", "balcony", "window"];

/**
 * Homepage "Sahara deep cleaning results": the before-N/after-N photo pairs under public/images/services/<folder>, one per
 * service first, then extra kitchen pairs. Drag-to-compare; swipe on phones. Renders nothing if no pair files exist.
 */
export function FeaturedResults() {
  const first = FEATURED_FOLDERS.flatMap((f) => beforeAfterPairsFor(f).slice(0, 1).map((p) => ({ ...p, folder: f })));
  const extra = beforeAfterPairsFor("kitchen").slice(1).map((p) => ({ ...p, folder: "kitchen" as SlideFolder }));
  const pairs = [...first, ...extra].slice(0, 9);
  if (pairs.length === 0) return null;
  return (
    <section aria-labelledby="results-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Results</p>
      <h2 id="results-title" className="mt-1 text-xl font-extrabold text-[#0a2540] sm:text-2xl">Before &amp; after — Sahara deep cleaning</h2>
      <p className="mt-1 text-sm text-[#0a2540]/70">Kitchen, bathroom, sofa, carpet, balcony and windows. Drag the handle to compare.</p>
      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible">
        {pairs.map((p) => (
          <div key={p.before} className="w-[85%] shrink-0 snap-center sm:w-[60%] lg:w-auto">
            <BeforeAfterSlider before={p.before} after={p.after} alt={p.alt} caption="Sample before / after — Sahara deep cleaning" ratioClass="aspect-square" />
          </div>
        ))}
      </div>
    </section>
  );
}
