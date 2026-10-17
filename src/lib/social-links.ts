// One place for Sahara's public profiles and the booking form, with UTM tags so every click is attributable
// (the CRM already reads utm_source / utm_medium / utm_campaign on a booking — lib/attribution.ts).
//
// Outbound (site / email → social): tagged with where the click came from.
// Inbound (social → booking form): bookingLink("instagram", "social", "ig_bio") etc.

export const BOOKING_BASE = (process.env.BOOKING_URL || "https://booking.saharacleaningservices.com").replace(/\/$/, "");

type Utm = { source: string; medium: string; campaign: string };

export function withUtm(url: string, utm: Utm): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", utm.source);
    u.searchParams.set("utm_medium", utm.medium);
    u.searchParams.set("utm_campaign", utm.campaign);
    return u.toString();
  } catch {
    return url;
  }
}

/** The public booking form, tagged with the channel that sent the customer. */
export const bookingLink = (source: string, medium: string, campaign: string) => withUtm(`${BOOKING_BASE}/booking`, { source, medium, campaign });

// Verified public profiles (checked 30 Sep 2026) — only these are linked. LinkedIn appears once its URL is
// set in LINKEDIN_URL (no verified page is on record yet, so none is invented).
const PROFILES = [
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/saharacleaningservices" },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/saharacleaningservices.pune/" },
  { key: "youtube", label: "YouTube", url: "https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA" },
  ...(process.env.LINKEDIN_URL?.startsWith("https://") ? [{ key: "linkedin", label: "LinkedIn", url: process.env.LINKEDIN_URL }] : []),
] as const;

/** Profile links for a footer / signature placement (e.g. "site_footer", "email_signature"). */
export const socialLinks = (placement: string) =>
  PROFILES.map((p) => ({ key: p.key, label: p.label, href: withUtm(p.url, { source: "sahara_site", medium: placement, campaign: `${p.key}_profile` }) }));

/** Plain-text signature for emails: booking form + profiles, all UTM-tagged. */
export function emailSignature(): string {
  const lines = ["— Sahara Cleaning Services, Pune", `Book online: ${bookingLink("email", "email", "email_signature")}`];
  for (const s of socialLinks("email_signature")) lines.push(`${s.label}: ${s.href}`);
  return lines.join("\n");
}
