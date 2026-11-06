// Parties list B2B / B2C toggle (2026-11-06). Segment comes from the MyBillBook book a party is billed in.
export const CUSTOMER_SEGMENTS = ["ALL", "B2B", "B2C"] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** All | B2B Corporate (GST) | B2C Retail (Non-GST). A party billed in both books shows under both. */
export function matchesSegment(segment: string | null | undefined, seg: string) {
  if (seg === "B2B") return segment === "B2B" || segment === "BOTH";
  if (seg === "B2C") return segment === "B2C" || segment === "BOTH";
  return true;
}
