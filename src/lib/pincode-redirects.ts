// Local SEO Batch 1 (owner 2026-11-04): these /pune/<area> pages are replaced by their pincode page (permanent 308).
// Batch 2 waits for the T+14 go/no-go. Pure data, no imports: next.config.ts loads this file.

export const PINCODE_BATCH1: Record<string, string> = {
  magarpatta: "/cleaning-services-magarpatta-411028",
  hadapsar: "/cleaning-services-hadapsar-411028",
  kharadi: "/cleaning-services-kharadi-411014",
  undri: "/cleaning-services-undri-411060",
  mohammadwadi: "/cleaning-services-mohammadwadi-411060",
  nibm: "/cleaning-services-nibm-road-411048",
  kondhwa: "/cleaning-services-kondhwa-411048",
};

export const PINCODE_REDIRECTS = Object.entries(PINCODE_BATCH1).map(([area, destination]) => ({
  source: `/pune/${area}`,
  destination,
  permanent: true as const,
}));

/** Link target for a Pune area: the pincode page once the area has moved to it, else /pune/<area>. */
export const areaPath = (slug: string) => PINCODE_BATCH1[slug] ?? `/pune/${slug}`;
