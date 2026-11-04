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
  if (cur && !isSourceTag(cur) && !(RETIRED_SOURCE_TAGS as readonly string[]).includes(cur)) opts.push({ value: cur, label: `${cur} (old value)` });
  return opts;
}

/** Retired tags read as "no tag" so they are never written again. */
export const activeSourceTag = (v?: string | null): string | null => {
  const t = (v ?? "").trim();
  return !t || (RETIRED_SOURCE_TAGS as readonly string[]).includes(t) ? null : t;
};
