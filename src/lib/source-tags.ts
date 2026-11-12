// Lead / party source tags (owner CRM data standard, 2026-11-04). Stored as plain text in
// Customer.source and Lead.sourceTag — no enum, so adding a tag never needs a migration.
// SRC-GMB-MAMURDI is retired: never offered, and cleared by scripts/clean-party-names.mjs --apply.
export const SOURCE_TAGS = [
  "SRC-GMB-MOHAMMADWADI",
  "SRC-GMB-MAGARPATTA",
  "SRC-META-ADS",
  "SRC-GOOGLE-ADS",
  "SRC-ORGANIC-SEO",
  "SRC-AI-GEO",
  "SRC-REFERENCE",
  "SRC-RETURN-CLIENT",
  "SRC-RECURRING-AMC",
  "SRC-CROSS-SELL-PEST",
  "SRC-CROSS-SELL-PAINTING",
] as const;
export type SourceTag = (typeof SOURCE_TAGS)[number];

/**
 * Campaign-level tags for the paid launch (owner 2026-11-12): Google Ads campaigns G1–G7 (G6 painting, G7 pest control), Meta Ads campaigns M1–M7 (M6 painting, M7 pest control), plus the
 * manual-only WhatsApp blast / website / direct-WhatsApp tags. Plain text like every tag here — no migration. G#/M# are filled
 * automatically from utm_campaign (see sourceTagForChannel); the rest are picked by staff, never guessed.
 */
export const CAMPAIGN_SOURCE_TAGS = [
  "SRC-GOOGLE-G1", "SRC-GOOGLE-G2", "SRC-GOOGLE-G3", "SRC-GOOGLE-G4", "SRC-GOOGLE-G5", "SRC-GOOGLE-G6", "SRC-GOOGLE-G7",
  "SRC-META-M1", "SRC-META-M2", "SRC-META-M3", "SRC-META-M4", "SRC-META-M5", "SRC-META-M6", "SRC-META-M7",
  "SRC-WA-4K-BLAST", "SRC-WEBSITE", "SRC-DIRECT-WA",
] as const;
export type CampaignSourceTag = (typeof CAMPAIGN_SOURCE_TAGS)[number];
export const isCampaignSourceTag = (v: unknown): v is CampaignSourceTag => typeof v === "string" && (CAMPAIGN_SOURCE_TAGS as readonly string[]).includes(v);

export const RETIRED_SOURCE_TAGS = ["SRC-GMB-MAMURDI"] as const;

export const SOURCE_TAG_LABEL: Record<SourceTag, string> = {
  "SRC-GMB-MOHAMMADWADI": "GMB · Mohammadwadi",
  "SRC-GMB-MAGARPATTA": "GMB · Magarpatta",
  "SRC-META-ADS": "Meta Ads",
  "SRC-GOOGLE-ADS": "Google Ads",
  "SRC-ORGANIC-SEO": "Organic SEO",
  "SRC-AI-GEO": "AI search (GEO)",
  "SRC-REFERENCE": "Reference",
  "SRC-RETURN-CLIENT": "Return client",
  "SRC-RECURRING-AMC": "Recurring AMC",
  "SRC-CROSS-SELL-PEST": "Cross-sell · Pest Control",
  "SRC-CROSS-SELL-PAINTING": "Cross-sell · Painting",
};

export const isSourceTag = (v: unknown): v is SourceTag => typeof v === "string" && (SOURCE_TAGS as readonly string[]).includes(v);

/** Picker options: every active tag, plus the record's current free-text value when it is not one (kept, never lost). */
export function sourceTagChoices(current?: string | null): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = SOURCE_TAGS.map((t) => ({ value: t, label: `${SOURCE_TAG_LABEL[t]} (${t})` }));
  const cur = (current ?? "").trim();
  for (const t of CAMPAIGN_SOURCE_TAGS) opts.push({ value: t, label: `Campaign · ${t.replace("SRC-", "")}` });
  if (cur && !isSourceTag(cur) && !isCampaignSourceTag(cur) && !(RETIRED_SOURCE_TAGS as readonly string[]).includes(cur)) opts.push({ value: cur, label: `${cur} (old value)` });
  return opts;
}

/** Retired tags read as "no tag" so they are never written again. */
export const activeSourceTag = (v?: string | null): string | null => {
  const t = (v ?? "").trim();
  return !t || (RETIRED_SOURCE_TAGS as readonly string[]).includes(t) ? null : t;
};

/**
 * Campaign number (1–7) a utm_campaign names for one ad platform: "g1_home_deep_clean", "pune-meta-m3", "G2" → 1/3/2.
 * Google Ads only reads G#, Meta Ads only reads M# — a "g2" inside a Meta campaign name is not a Google campaign.
 */
export function campaignNumber(campaign: string | null | undefined, letter: "g" | "m"): number | null {
  const m = new RegExp(`(?:^|[^a-z0-9])${letter}\\s*([1-7])(?![a-z0-9])`, "i").exec(campaign ?? "");
  return m ? Number(m[1]) : null;
}

/** Which Google Business Profile branch a utm_campaign names ("magarpatta", "mohammadwadi", "mohdwadi"…); null when it names neither. */
export function gmbBranchOf(campaign: string | null | undefined, medium?: string | null): "MAGARPATTA" | "MOHAMMADWADI" | null {
  // The live GMB listing links name the branch in utm_medium ("magarpatta_branch"); newer links put it in utm_campaign.
  const c = `${(campaign ?? "").toLowerCase()} ${(medium ?? "").toLowerCase()}`;
  if (c.includes("magarpatta")) return "MAGARPATTA";
  if (/moh(a|u)?m*(a)?d?w?adi|mohd/.test(c)) return "MOHAMMADWADI";
  return null;
}

/**
 * Source tag for a lead the website classified (owner 2026-11-12):
 *  - Google Ads → SRC-GOOGLE-G# when utm_campaign names G1–G7, else SRC-GOOGLE-ADS
 *  - Meta Ads   → SRC-META-M# when utm_campaign names M1–M7, else SRC-META-ADS
 *  - Google Business Profile → SRC-GMB-MAGARPATTA / SRC-GMB-MOHAMMADWADI from utm_campaign or utm_medium (a GMB link that names neither stays untagged)
 *  - Google Organic/SEO → SRC-ORGANIC-SEO
 * Every other channel returns null so staff keep choosing reference / return-client tags by hand — nothing is guessed.
 */
export function sourceTagForChannel(channel: string | null | undefined, campaign?: string | null, medium?: string | null): SourceTag | CampaignSourceTag | null {
  if (channel === "Google Ads") {
    const n = campaignNumber(campaign, "g");
    return n ? (`SRC-GOOGLE-G${n}` as CampaignSourceTag) : "SRC-GOOGLE-ADS";
  }
  if (channel === "Meta Ads") {
    const n = campaignNumber(campaign, "m");
    return n ? (`SRC-META-M${n}` as CampaignSourceTag) : "SRC-META-ADS";
  }
  if (channel === "Google Business Profile") {
    const b = gmbBranchOf(campaign, medium);
    return b ? (`SRC-GMB-${b}` as SourceTag) : null;
  }
  if (channel === "Google Organic/SEO") return "SRC-ORGANIC-SEO";
  return null;
}
