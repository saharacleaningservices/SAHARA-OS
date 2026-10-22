// Featured Reviews (Settings → Social Proof) are stored in CompanySettings.featuredReviews as a JSON array of
// { name, text, rating }. Readers: the booking page carousel (app/book/page.tsx — first 5 with name + text) and the
// owner command centre. These helpers let the Settings form edit that JSON as simple rows without losing anything:
// unknown extra keys on an entry are kept, and text that is not a JSON array is reported instead of being overwritten.

export type FeaturedReview = { name: string; text: string; rating: number; extra?: Record<string, unknown> };

export const MAX_FEATURED_REVIEWS = 10;
export const SHOWN_ON_BOOKING_PAGE = 5;

export type ParsedReviews = { ok: true; reviews: FeaturedReview[] } | { ok: false; raw: string };

const clampRating = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 5;
};

/** Stored JSON -> editable rows. Blank = no reviews. Anything that is not an array of objects is returned untouched. */
export function parseFeaturedReviews(raw: string | null | undefined): ParsedReviews {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, reviews: [] };
  let data: unknown;
  try {
    data = JSON.parse(s);
  } catch {
    return { ok: false, raw: s };
  }
  if (!Array.isArray(data) || data.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return { ok: false, raw: s };
  return {
    ok: true,
    reviews: (data as Record<string, unknown>[]).map(({ name, text, rating, ...extra }) => ({
      name: typeof name === "string" ? name : "",
      text: typeof text === "string" ? text : "",
      rating: clampRating(rating),
      ...(Object.keys(extra).length ? { extra } : {}),
    })),
  };
}

/** Rows -> stored JSON. Rows with no name and no text are dropped; empty list = "" (the booking page then shows only the rating). */
export function serializeFeaturedReviews(reviews: FeaturedReview[]): string {
  const kept = reviews
    .map((r) => ({ ...r, name: r.name.trim(), text: r.text.trim() }))
    .filter((r) => r.name || r.text)
    .slice(0, MAX_FEATURED_REVIEWS)
    .map(({ name, text, rating, extra }) => ({ ...(extra ?? {}), name, text, rating: clampRating(rating) }));
  return kept.length ? JSON.stringify(kept) : "";
}
