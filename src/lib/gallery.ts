// Shared constants for the marketing gallery (before/after photos + result
// videos). Used by the admin gallery panel, the public booking page and the
// WhatsApp booking-confirmation link.

export const GALLERY_TYPES = ["PHOTO", "VIDEO"] as const;
export const GALLERY_KINDS = ["BEFORE", "AFTER", "GENERAL"] as const;

export const GALLERY_KIND_LABELS: Record<string, string> = {
  BEFORE: "Before",
  AFTER: "After",
  GENERAL: "Showcase",
};

export const GALLERY_CATEGORIES = [
  "Home Deep Cleaning",
  "Commercial Cleaning",
  "Interior Painting",
  "Pest Control",
  "Sofa & Carpet",
  "Kitchen & Bathroom",
  "Other",
] as const;

/** Public before/after gallery, shared with customers in the WhatsApp confirmation. */
export const GALLERY_PUBLIC_URL = "https://app.saharacleaningservices.com/gallery";

/** Cleaning tips / aftercare guide, linked from the booking confirmation. */
export const CLEANING_TIPS_URL = "https://app.saharacleaningservices.com/gallery#tips";

export type GalleryItemView = {
  id: string;
  type: string;
  kind: string;
  category: string | null;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  pairKey: string | null;
  featured: boolean;
  sortOrder: number;
};

/** Group BEFORE/AFTER photos that share a pairKey into side-by-side pairs. */
export function toBeforeAfterPairs(items: GalleryItemView[]) {
  const byKey = new Map<string, { before?: GalleryItemView; after?: GalleryItemView; category: string | null; caption: string | null }>();
  for (const it of items) {
    if (it.type !== "PHOTO" || !it.pairKey || (it.kind !== "BEFORE" && it.kind !== "AFTER")) continue;
    const entry = byKey.get(it.pairKey) ?? { category: it.category, caption: it.caption };
    if (it.kind === "BEFORE") entry.before = it;
    else entry.after = it;
    entry.category = entry.category ?? it.category;
    entry.caption = entry.caption ?? it.caption;
    byKey.set(it.pairKey, entry);
  }
  return [...byKey.values()].filter((p) => p.before && p.after);
}
