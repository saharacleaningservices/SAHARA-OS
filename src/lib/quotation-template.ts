// Standard single-page quotation wording for Sahara Cleaning Services (owner-supplied, 17 Oct 2026).
// Pure data + helpers, no I/O. Used by documentScope() (scope / exclusions), the quotation PDF route (terms)
// and createQuotation (default terms). Package prices are NOT here — they come from the pricing master.

import type { HomeTier } from "@/lib/service-scope";

export const PREMIUM_SCOPE = [
  "Ceiling & wall dry dusting (cobweb / spider-web removal with brush)",
  "Fan, light and door dusting",
  "Window glass cleaning and sliding-channel vacuuming",
  "Appliances: exterior cleaning",
  "Sofa and mattress dry vacuuming",
  "Bathroom and kitchen deep cleaning",
  "Floor machine scrubbing",
] as const;

export const PLATINUM_EXTRA_SCOPE = ["Wall wet cleaning / wipe-down (for washable paints)"] as const;

/** Complimentary offer highlight printed under a Premium / Platinum package. Set to "" to switch it off. */
export const FREE_FRIDGE_NOTE = "(Single Fridge Internal Deep Cleaning Included FREE for this booking)";

export const QUOTATION_EXCLUSIONS = [
  "Protective plastic wrap removal (post-interior work) is EXCLUDED.",
  "Excessive glue, paint-stain scraping and cement removal are EXCLUDED.",
  "Upholstery (sofa / carpet / mattress) foam & shampoo wet cleaning is EXCLUDED (dry vacuuming is included).",
] as const;

export const STANDARD_TERMS_LINES = [
  "Cabinets / wardrobes are cleaned internally ONLY if emptied by the customer before arrival.",
  "Customer to arrange electricity, continuous water supply and a stool / ladder.",
  "Old / hard stains are treated to the best of our ability (100% removal is not guaranteed without surface damage).",
  "Final inspection is required before the team leaves. 100% payment immediately via UPI or Cash.",
] as const;

/** Stored on new quotations as the default terms. */
export const STANDARD_TERMS_TEXT = STANDARD_TERMS_LINES.map((l, i) => `${i + 1}. ${l}`).join("\n");

/** Scope bullets for a full-house package: Premium list, Platinum = Premium + wall wet cleaning. */
export function packageScopeLines(tier: HomeTier): string[] {
  return tier === "Platinum" ? [...PREMIUM_SCOPE, ...PLATINUM_EXTRA_SCOPE] : [...PREMIUM_SCOPE];
}

/**
 * Terms printed on a quotation PDF. Quotations created before this template carry the old default
 * ("1. Prices are inclusive of standard materials…", with the retired 50%-advance line); they print the standard terms.
 * Anything else (B2B / AMC proposal text, edited terms) is the customer-specific agreement and prints as stored.
 * Nothing is changed in the database.
 */
export function resolveQuotationTerms(stored: string | null | undefined): { text: string; custom: boolean } {
  const t = (stored ?? "").trim();
  if (!t || /^1\.\s*Prices are inclusive of standard materials/i.test(t) || t === STANDARD_TERMS_TEXT) return { text: STANDARD_TERMS_TEXT, custom: false };
  return { text: t, custom: true };
}
