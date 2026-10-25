// Standard single-page quotation wording for Sahara Cleaning Services (owner-supplied, 17 Oct 2026).
// Pure data + helpers, no I/O. Used by documentScope() (scope / exclusions), the quotation PDF route (terms)
// and createQuotation (default terms). Package prices are NOT here — they come from the pricing master.

import type { HomeTier } from "@/lib/service-scope";

// Package scope updated by the owner on 22 Oct 2026: Premium adds refrigerator / microwave and chimney EXTERIOR cleaning and
// dry vacuuming of sofa, mattresses, curtains and carpets; Platinum adds wall wet cleaning and full chimney cleaning.
export const PREMIUM_SCOPE = [
  "Ceiling & wall dry dusting (cobweb / spider-web removal with brush)",
  "Fan, light and door dusting",
  "Window glass cleaning and sliding-channel vacuuming",
  "Refrigerator & microwave exterior cleaning",
  "Kitchen chimney exterior cleaning",
  "Dry vacuuming of sofa, mattresses, curtains and carpets",
  "Bathroom and kitchen deep cleaning",
  "Floor machine scrubbing",
] as const;

export const PLATINUM_EXTRA_SCOPE = [
  "Wall wet cleaning / wipe-down (for washable paints)",
  "Kitchen chimney cleaning (full)",
] as const;

/** Complimentary offer highlight printed under a Premium / Platinum package. Set to "" to switch it off. */
export const FREE_FRIDGE_NOTE = "(Single Fridge Internal Deep Cleaning Included FREE for this booking)";

export const QUOTATION_EXCLUSIONS = [
  "Protective plastic wrap removal (post-interior work) is EXCLUDED.",
  "Excessive glue, paint-stain scraping and cement removal are EXCLUDED.",
  "Upholstery (sofa / carpet / mattress) foam & shampoo wet cleaning is EXCLUDED (dry vacuuming is included).",
] as const;

export const STANDARD_TERMS_LINES = [
  "Cabinets / wardrobes are cleaned internally ONLY if emptied by the customer before arrival.",
  "Customer to arrange electricity, continuous water supply and a step-ladder / stool where required.",
  "Old / hard stains are treated to the best of our ability (100% removal is not guaranteed without surface damage).",
  "Final inspection is required before the team leaves. 20% advance confirms the booking; the 80% balance is payable after work completion via UPI or Cash.",
  "Cash, jewellery and valuables must be kept locked under key before the team starts.",
] as const;

/** The 4-line standard terms used until 22 Oct 2026 — quotations that stored them still count as "standard" and print the current terms. */
const STANDARD_TERMS_LINES_2026_10_18 = [
  "Cabinets / wardrobes are cleaned internally ONLY if emptied by the customer before arrival.",
  "Customer to arrange electricity, continuous water supply and a stool / ladder.",
  "Old / hard stains are treated to the best of our ability (100% removal is not guaranteed without surface damage).",
  "Final inspection is required before the team leaves. 20% advance confirms the booking; the 80% balance is payable after work completion via UPI or Cash.",
] as const;

/** The standard terms as stored on quotations created 17 Oct 2026 (100%-immediately wording) — printed with the 20/80 line now. */
const PREVIOUS_STANDARD_LINE4 = "Final inspection is required before the team leaves. 100% payment immediately via UPI or Cash.";

/** Older default wording for the advance rule (50% / 100%) → the current 20% advance / 80% balance rule. Custom terms are otherwise untouched. */
export function modernizePaymentTerms(text: string): string {
  return text
    .replace(PREVIOUS_STANDARD_LINE4, STANDARD_TERMS_LINES[3])
    .replace(/50% advance payment confirms the booking; balance is due on job completion\./g, "20% advance payment confirms the booking; the 80% balance is payable after job completion.");
}

/** Stored on new quotations as the default terms. */
export const STANDARD_TERMS_TEXT = STANDARD_TERMS_LINES.map((l, i) => `${i + 1}. ${l}`).join("\n");

/** Scope bullets for a full-house package: Premium list, Platinum = Premium + wall wet cleaning + full chimney cleaning. */
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
  const numbered = (lines: readonly string[]) => lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
  const legacyStd = numbered(STANDARD_TERMS_LINES_2026_10_18.map((l, i) => (i === 3 ? PREVIOUS_STANDARD_LINE4 : l)));
  const previousStd = numbered(STANDARD_TERMS_LINES_2026_10_18);
  if (!t || /^1\.\s*Prices are inclusive of standard materials/i.test(t) || t === STANDARD_TERMS_TEXT || t === legacyStd || t === previousStd) return { text: STANDARD_TERMS_TEXT, custom: false };
  return { text: modernizePaymentTerms(t), custom: true };
}

/** Printed under the Terms on every quotation (owner 2026-10-25). Not part of the stored terms, so standard / custom detection is unchanged. */
export const MSMED_NOTE =
  "Note: Sahara Cleaning Services is an MSME. Payment delayed beyond the agreed terms attracts interest under Sections 15–16 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006.";

/** Sahara's WhatsApp Business number (owner 2026-10-25) — the quotation's "Confirm on WhatsApp" link. */
export const QUOTATION_WHATSAPP_NUMBER = "917083347130";

/** wa.me link that opens a chat with Sahara, the quote number prefilled. */
export function quotationWhatsAppLink(quoteNumber: string): { url: string; display: string } {
  const text = `Hi Sahara, I accept quotation ${quoteNumber}. Please confirm my booking slot.`;
  return { url: `https://wa.me/${QUOTATION_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, display: `wa.me/${QUOTATION_WHATSAPP_NUMBER} · Ref ${quoteNumber}` };
}
