import { BadgeCheck, FlaskConical, RotateCcw, ReceiptText, Star } from "lucide-react";
import type { FeaturedReview } from "@/lib/featured-reviews";

/**
 * Trust & social proof (owner directive 2026-11-12, Urban Company / Vijay Home Services style).
 * The promise wording is the owner's; the review cards show ONLY real entries saved in Settings → Social Proof — nothing is invented,
 * and the whole section stays hidden until at least one real review exists.
 */
const PROMISES = [
  { Icon: BadgeCheck, title: "Background-verified staff", body: "In-house, trained Sahara team" },
  { Icon: FlaskConical, title: "Eco-safe chemicals", body: "Hospital-grade, safe for family & pets" },
  { Icon: RotateCcw, title: "100% re-clean guarantee", body: "Free re-clean within 48 hours" },
  { Icon: ReceiptText, title: "Zero hidden charges", body: "Price shown is the price you pay" },
] as const;

export function HygienePromise({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="promise-h" className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ring-primary/10 sm:p-4 ${className}`}>
      <h2 id="promise-h" className="text-center text-sm font-extrabold uppercase tracking-wide text-primary">Sahara Hygiene &amp; Safety Promise</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PROMISES.map(({ Icon, title, body }) => (
          <li key={title} className="flex items-start gap-2 rounded-xl bg-[#f5f8fd] p-2.5">
            <Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <span><span className="block text-[13px] font-extrabold leading-tight text-[#0a2540]">{title}</span><span className="block text-xs text-[#0a2540]/65">{body}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CustomerReviews({ reviews, reviewUrl, className = "" }: { reviews: FeaturedReview[]; reviewUrl?: string; className?: string }) {
  const list = reviews.filter((r) => r.name && r.text).slice(0, 6);
  if (!list.length) return null;
  return (
    <section aria-labelledby="reviews-h" className={className}>
      <h2 id="reviews-h" className="text-center text-lg font-extrabold text-[#0a2540]">What Pune customers say</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <li key={`${r.name}-${r.text.slice(0, 16)}`} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <p className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: r.rating }, (_, n) => <Star key={n} className="size-4 fill-amber-400 text-amber-400" aria-hidden />)}</p>
            <p className="mt-2 flex-1 text-sm text-[#0a2540]/85">&ldquo;{r.text}&rdquo;</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs font-bold text-[#0a2540]">{r.name}{r.locality && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{r.locality}, Pune</span>}</p>
          </li>
        ))}
      </ul>
      {reviewUrl && <p className="mt-3 text-center"><a href={reviewUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary underline-offset-2 hover:underline">Read all Google reviews →</a></p>}
    </section>
  );
}
