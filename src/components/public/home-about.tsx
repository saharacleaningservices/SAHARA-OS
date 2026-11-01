import Link from "next/link";
import { BadgeCheck, CalendarClock, ReceiptText, ShieldCheck, Star } from "lucide-react";
import { TRUST } from "@/lib/booking-target";

/**
 * About section (owner 2026-11-01): full-width two-column split, large high-contrast copy, 2×2 trust grid and live review badge.
 * Layout model: BOXED (`max-w-6xl`) on desktop, stacked on mobile. Claims are facts the business can prove: the years figure is
 * computed from the founding year (2012), never a fixed marketing number.
 */
export function HomeAbout({ reviewUrl, rating = TRUST.rating, reviews = TRUST.siteReviewLabel }: { reviewUrl?: string; rating?: string; reviews?: string }) {
  const years = Math.max(1, new Date().getFullYear() - TRUST.since);
  const badges = [
    { icon: CalendarClock, title: `${years}+ Years`, sub: `Serving Pune since ${TRUST.since}` },
    { icon: ShieldCheck, title: "100% In-House Crew", sub: "Verified, trained Sahara staff" },
    { icon: BadgeCheck, title: "Same-Day Slots", sub: "Subject to team availability" },
    { icon: ReceiptText, title: "GST Billing", sub: "Proper tax invoice for every job" },
  ];
  return (
    <section aria-labelledby="about-title" className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">About Sahara Cleaning Services</p>
          <h2 id="about-title" className="mt-2 text-3xl font-extrabold leading-tight text-[#0a2540] sm:text-4xl">Pune&apos;s own cleaning, pest control &amp; painting team — since {TRUST.since}</h2>
          <p className="mt-4 text-lg leading-relaxed text-[#0a2540]/90 xl:text-xl">From Magarpatta City and Mohammadwadi, our own trained crew looks after homes, offices, societies and showrooms across Pune and PCMC — deep cleaning, housekeeping contracts, post-interior cleaning, pest control and painting.</p>
          <p className="mt-3 text-lg leading-relaxed text-[#0a2540]/90 xl:text-xl">You get a written quote before work starts, a crew that arrives on time, and a GST invoice at the end. No sub-contractors, no surprises.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/booking" className="min-h-12 rounded-xl bg-primary px-6 py-3 text-base font-bold text-white">Book Now</Link>
            <Link href="/contact" className="min-h-12 rounded-xl border-2 border-primary px-6 py-3 text-base font-bold text-primary">Talk to us</Link>
          </div>
        </div>
        <div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4">
            {badges.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="rounded-2xl bg-[#eef4fb] p-4 sm:p-5">
                <Icon className="size-7 text-primary" aria-hidden />
                <p className="mt-2 text-lg font-extrabold leading-tight text-[#0a2540] sm:text-xl">{title}</p>
                <p className="mt-0.5 text-sm text-[#0a2540]/75">{sub}</p>
              </li>
            ))}
          </ul>
          <a href={reviewUrl || "#"} target={reviewUrl ? "_blank" : undefined} rel="noopener noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl bg-[#0a2540] p-4 text-white" aria-label={`${reviews} Google reviews, rated ${rating} out of 5`}>
            <Star className="size-8 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
            <span><span className="block text-xl font-extrabold leading-tight sm:text-2xl">{reviews} Google {rating}★ Reviews</span><span className="block text-sm text-white/75">Rated by Pune customers on Google</span></span>
          </a>
        </div>
      </div>
    </section>
  );
}
