// Smart review funnel keyword chips (owner 2026-10-25): natural, human-sounding review lines per service, with the local
// keywords Google reads (service + Pune + area). 4–5 chips are shown per visit, shuffled per session, so the reviews a
// customer posts never look copy-pasted from one template.

export type ReviewService = "HOME_DEEP_CLEANING" | "COMMERCIAL_CLEANING" | "HOUSEKEEPING" | "PEST_CONTROL" | "INTERIOR_PAINTING" | "GENERAL";

const POOL: Record<ReviewService, string[]> = {
  HOME_DEEP_CLEANING: [
    "Sahara did a spotless home deep cleaning in Pune — the kitchen and bathrooms look brand new.",
    "Best deep cleaning service in Pune. The team was on time, polite and very thorough.",
    "Booked Sahara Cleaning Services for flat deep cleaning in Magarpatta — great value and a really fresh home.",
    "Professional machine cleaning, sofa and floor shine like new. Highly recommend for home deep cleaning in Pune.",
    "Very happy with the bathroom and kitchen deep cleaning. Fair price, no hidden charges.",
    "Quick booking on WhatsApp and a neat, hygienic result. Our go-to home cleaning service in Hadapsar.",
    "The crew was careful with our furniture and left the house spotless. Five stars for Sahara.",
  ],
  COMMERCIAL_CLEANING: [
    "Sahara cleaned our Pune office floors with machines overnight — ready for work next morning.",
    "Reliable commercial cleaning in Pune. Disciplined staff, good equipment and fair pricing.",
    "Great post-construction and office deep cleaning. Glass, floors and washrooms all spotless.",
    "We use Sahara for office housekeeping in Hadapsar — consistent quality and quick response.",
    "Professional commercial cleaning service in Pune. Clear quotation, on-time team, clean finish.",
    "Machine scrubbing of our showroom floor was excellent. Would happily book Sahara again.",
  ],
  HOUSEKEEPING: [
    "Sahara's housekeeping staff are trained, punctual and well-behaved. Our office stays spotless.",
    "Dependable housekeeping contract in Pune — consistent staff and zero follow-ups needed.",
    "Happy with Sahara's housekeeping service for our society office in Hadapsar. Highly professional.",
    "Good manpower, proper supervision and a clean workplace every day. Recommended in Pune.",
    "Very responsive team for housekeeping and AMC. Fair rates and reliable service.",
  ],
  PEST_CONTROL: [
    "Sahara's pest control in Pune worked — cockroaches and ants gone within days.",
    "Safe, odourless pest control treatment. The technician explained everything clearly.",
    "Effective termite and cockroach treatment for our flat in Magarpatta. Reasonable price and good follow-up.",
    "Quick appointment, professional pest control team and visible results. Highly recommend.",
    "Used Sahara for bed bug treatment in Pune — thorough work and no mess left behind.",
    "Great pest control service in Hadapsar with a service warranty. Very satisfied.",
  ],
  INTERIOR_PAINTING: [
    "Sahara painted our 2 BHK in Pune beautifully — neat finish, no stains on the floor.",
    "Professional interior painting service with a smooth wall finish and on-time completion.",
    "Good quality paint work and clean-up afterwards. Best painting service we found in Hadapsar.",
    "Fair quotation, skilled painters and furniture covered properly. Recommend Sahara for painting in Pune.",
    "Our home looks new after Sahara's interior painting. Very happy with the colour and finish.",
  ],
  GENERAL: [
    "Excellent cleaning service in Pune — professional team, fair price and a spotless result.",
    "Sahara Cleaning Services in Hadapsar is prompt, polite and thorough. Highly recommended.",
    "Easy booking on WhatsApp, on-time team and great quality of work. Five stars.",
    "Trusted home and office cleaning company in Pune. Transparent pricing and neat work.",
    "Very satisfied with Sahara Cleaning Services — I will happily book them again.",
  ],
};

/** Map a job's service value to a pool; anything unknown falls back to the general pool. */
export function reviewServiceOf(service: string | null | undefined): ReviewService {
  return service && service in POOL ? (service as ReviewService) : "GENERAL";
}

/** Small deterministic PRNG (mulberry32) so a session's shuffle is stable across re-renders but different between sessions. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 4–5 chips for `service`, shuffled by `seed` (store the seed in sessionStorage so a refresh keeps the same set). */
export function pickReviewChips(service: ReviewService, seed: number, count = 5): string[] {
  const pool = [...POOL[service]];
  const next = rng(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = Math.max(4, Math.min(5, count, pool.length));
  return pool.slice(0, n);
}

export const reviewPoolSize = (s: ReviewService) => POOL[s].length;
