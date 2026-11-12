// CTR meta descriptions (owner 2026-11-12, "Zero-Risk CTR & Scope Clarity Upgrade").
// DESCRIPTIONS ONLY — page titles, H1s, canonicals and URLs of pages ranking in positions 1–3 are deliberately not touched here.
// Every ₹ figure is read from PRICING_MASTER, so a rate change on the booking site can never leave a stale price in Google's snippet.
import { PRICING_MASTER } from "@/lib/pricing-master";

const priceOf = (contentId: string): number => {
  const p = PRICING_MASTER.find((i) => i.contentId === contentId)?.price;
  if (typeof p !== "number") throw new Error(`ctr-meta: no public price for ${contentId}`);
  return p;
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Lowest fixed home package: 1 BHK unfurnished. Furnished starts at the 1 BHK Premium rate. */
export const HOME_FROM_UNFURNISHED = () => priceOf("SCS-UF-1");
export const HOME_FROM_FURNISHED = () => priceOf("SCS-01");
export const SOFA_PER_SEAT = () => priceOf("SCS-09");
export const MATTRESS_EACH = () => priceOf("SCS-11");

export function ctrDescriptions() {
  return {
    // Homepage: the page prefixes the official brand tagline (owner rule 2026-11-03), so this is the part that follows it.
    home: `Home deep cleaning from ${inr(HOME_FROM_UNFURNISHED())}, sofa ${inr(SOFA_PER_SEAT())}/seat. In-house trained staff. Pay after service in Pune & PCMC.`,
    "home-deep-cleaning": `Full house deep cleaning in Pune: unfurnished from ${inr(HOME_FROM_UNFURNISHED())}, furnished 1 BHK ${inr(HOME_FROM_FURNISHED())}. Heavy scrubbing machine, in-house trained staff. Pay after service.`,
    "sofa-carpet-mattress-cleaning": `Sofa shampooing ${inr(SOFA_PER_SEAT())} per seat, mattress ${inr(MATTRESS_EACH())}, carpet cleaning in Pune. Machine wet extraction by in-house trained staff. Pay after service.`,
  } as const;
}

/** Override description for a /services/<slug> page, or undefined when the page keeps its existing description. */
export function ctrDescriptionFor(slug: string): string | undefined {
  const d = ctrDescriptions();
  return slug === "home-deep-cleaning" || slug === "sofa-carpet-mattress-cleaning" ? d[slug] : undefined;
}
