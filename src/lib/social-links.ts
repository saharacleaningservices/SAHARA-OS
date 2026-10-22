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

// Verified public profiles (checked 30 Sep 2026) — only these are linked. LinkedIn is added from the
// "LinkedIn page link" in Settings (or the LINKEDIN_URL env var); no page is on record, so none is invented.
export const FIXED_PROFILES = [
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/saharacleaningservices" },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/saharacleaningservices.pune/" },
  { key: "youtube", label: "YouTube", url: "https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA" },
] as const;

const isLinkedIn = (u: string | null | undefined): u is string => !!u && /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(u);

export type SocialKey = "facebook" | "instagram" | "youtube" | "linkedin";
export type SocialLink = { key: SocialKey; label: string; href: string };

/**
 * Profile links for a placement — "footer" or "email_signature" becomes utm_source (owner spec 2026-10-18):
 * `…?utm_source=footer&utm_medium=social&utm_campaign=facebook_profile`.
 */
export function socialLinks(placement: "footer" | "email_signature", linkedinUrl?: string | null): SocialLink[] {
  const li = isLinkedIn(linkedinUrl) ? linkedinUrl : isLinkedIn(process.env.LINKEDIN_URL) ? process.env.LINKEDIN_URL : null;
  const all: { key: SocialKey; label: string; url: string }[] = [...FIXED_PROFILES, ...(li ? [{ key: "linkedin" as const, label: "LinkedIn", url: li }] : [])];
  return all.map((p) => ({ key: p.key, label: p.label, href: withUtm(p.url, { source: placement, medium: "social", campaign: `${p.key}_profile` }) }));
}

/** Clean profile URLs (no tracking) — for structured data `sameAs`. */
export const socialProfileUrls = (linkedinUrl?: string | null) => socialLinks("footer", linkedinUrl).map((l) => l.href.split("?")[0]);

/** Plain-text signature (fallback part of every email): booking form + profiles, all UTM-tagged. */
export function emailSignature(linkedinUrl?: string | null): string {
  const lines = ["— Sahara Cleaning Services, Pune", `Book online: ${bookingLink("email_signature", "email", "booking_cta")}`];
  for (const s of socialLinks("email_signature", linkedinUrl)) lines.push(`${s.label}: ${s.href}`);
  return lines.join("\n");
}
