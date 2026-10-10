// Marketing attribution — shared by the public pages (capture) and the
// server (classification). Pure functions only, no DB access.
//
// Rule: a lead's ORIGINAL channel is decided once, from its first touch, and
// is never overwritten. When there is no reliable signal we record
// "Unattributed" rather than guess.

export const ACQUISITION_CHANNELS = [
  "Google Ads",
  "Meta Ads",
  "Instagram Organic",
  "Facebook Organic",
  "Google Business Profile",
  "Google Organic/SEO",
  "Website Direct",
  "WhatsApp Direct",
  "WhatsApp Marketing",
  "Phone Call",
  "Referral",
  "Repeat Customer",
  "Other",
  "Unattributed",
] as const;
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export type Touch = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  landingPageUrl?: string | null;
  at?: string | null; // ISO timestamp
};

export type AttributionPayload = { first?: Touch | null; latest?: Touch | null };

const lc = (v?: string | null) => (v ?? "").trim().toLowerCase();
const host = (url?: string | null) => {
  try {
    return url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
};

/** Classify one touch into an acquisition channel. Never guesses. */
export function classifyTouch(t?: Touch | null): AcquisitionChannel {
  if (!t) return "Unattributed";
  const src = lc(t.source);
  const med = lc(t.medium);
  const ref = host(t.referrer);

  // Explicit click IDs are the strongest paid signals.
  if (t.gclid) return "Google Ads";
  if (src && ["google", "adwords", "google_ads", "googleads"].includes(src) && ["cpc", "ppc", "paid", "paid_search"].includes(med)) return "Google Ads";
  // The "<network>_ads" source names are explicit paid tags — the medium doesn't matter.
  if (src && ["google_ads", "googleads", "adwords"].includes(src)) return "Google Ads";
  if (src && ["meta_ads", "metaads", "facebook_ads", "fb_ads", "instagram_ads", "ig_ads"].includes(src)) return "Meta Ads";

  // Tagged links (UTMs) — Sahara's own naming convention.
  if (src === "gmb" || src === "google_business_profile" || src === "gbp") return "Google Business Profile";
  // A WhatsApp link that carries a campaign name comes from a broadcast.
  if (src === "whatsapp") return med === "marketing" || med === "broadcast" || lc(t.campaign) ? "WhatsApp Marketing" : "WhatsApp Direct";
  if (["facebook", "fb", "instagram", "ig", "meta"].includes(src)) {
    if (["cpc", "paid", "paid_social", "ads"].includes(med) || t.fbclid) return "Meta Ads";
    return src === "instagram" || src === "ig" ? "Instagram Organic" : "Facebook Organic";
  }
  if (src === "referral" || med === "referral") return "Referral";
  if (src) return "Other";

  // Untagged: fbclid alone is added by Meta to every outbound click (paid or
  // organic), so it only tells us "Meta", not "paid" — keep it organic.
  if (t.fbclid) return ref.includes("instagram") ? "Instagram Organic" : "Facebook Organic";

  // Referrer-only signals.
  if (ref) {
    if (/(^|\.)google\./.test(ref)) return "Google Organic/SEO";
    if (ref.includes("instagram")) return "Instagram Organic";
    if (ref.includes("facebook")) return "Facebook Organic";
    if (ref.includes("whatsapp")) return "WhatsApp Direct";
    if (ref.endsWith("saharacleaningservices.com")) return "Website Direct";
    return "Other";
  }

  // A recorded visit with no referrer and no tags = typed/bookmarked.
  return t.at ? "Website Direct" : "Unattributed";
}

/**
 * Channel for a lead the office enters by hand, from its Lead Source. Only
 * unambiguous sources map automatically; "Google", "Facebook" and "Instagram"
 * could be an ad or organic, so staff pick the channel explicitly or the lead
 * stays "Unattributed" rather than being guessed.
 */
const MANUAL_SOURCE_CHANNEL: Record<string, AcquisitionChannel> = {
  CALL: "Phone Call",
  WHATSAPP: "WhatsApp Direct",
  WEBSITE: "Website Direct",
  GMB: "Google Business Profile",
  META: "Meta Ads",
};

export function channelForManualLead(source: string, picked?: string | null): AcquisitionChannel {
  if (picked && (ACQUISITION_CHANNELS as readonly string[]).includes(picked)) return picked as AcquisitionChannel;
  return MANUAL_SOURCE_CHANNEL[source] ?? "Unattributed";
}

/** Festival campaign names used in UTM tags, so the dashboard can group them. */
export const FESTIVAL_CAMPAIGN_PATTERN = /festival|navratri|dussehra|dasara|diwali/i;

/** Human-readable campaign label for a touch (utm_campaign, else none). */
export function campaignOf(t?: Touch | null): string | null {
  const c = (t?.campaign ?? "").trim();
  return c ? c.slice(0, 120) : null;
}

/** Clamp every string in a touch so untrusted client input stays bounded. */
export function sanitizeTouch(t: unknown): Touch | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  const s = (k: string, max = 200) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : null);
  return {
    source: s("source"),
    medium: s("medium"),
    campaign: s("campaign"),
    term: s("term"),
    content: s("content"),
    gclid: s("gclid", 300),
    fbclid: s("fbclid", 300),
    referrer: s("referrer", 500),
    landingPage: s("landingPage"),
    landingPageUrl: s("landingPageUrl", 1000),
    at: s("at", 40),
  };
}

/** Dashboard "Lead Source Breakdown" buckets (owner 2026-10-10). Unknown stays Unknown — never folded into Organic. */
export const LEAD_SOURCE_BUCKETS = ["Google Ads", "Meta Ads", "WhatsApp Broadcast", "Organic", "Direct (WhatsApp / Call / Referral)", "Unknown / not tracked"] as const;
export type LeadSourceBucket = (typeof LEAD_SOURCE_BUCKETS)[number];
export function leadSourceBucket(channel: string | null | undefined): LeadSourceBucket {
  switch (channel) {
    case "Google Ads":
      return "Google Ads";
    case "Meta Ads":
      return "Meta Ads";
    case "WhatsApp Marketing":
      return "WhatsApp Broadcast";
    case "Google Organic/SEO":
    case "Google Business Profile":
    case "Instagram Organic":
    case "Facebook Organic":
    case "Website Direct":
      return "Organic";
    case "WhatsApp Direct":
    case "Phone Call":
    case "Referral":
    case "Repeat Customer":
      return "Direct (WhatsApp / Call / Referral)";
    default:
      return "Unknown / not tracked";
  }
}
