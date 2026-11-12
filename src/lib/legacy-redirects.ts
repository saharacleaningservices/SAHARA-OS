// 301 redirect map: legacy URLs (WordPress-era slugs + the sahara-web /<service>/<area> pages)
// -> Sahara OS routes (/services/<service>/<area>, hubs and top-level landing pages).
// Consumed by next.config.ts redirects(). Pure data + generation, no imports, so it is unit-testable.

export type LegacyRedirect = { source: string; destination: string; statusCode: 301 };

export const SERVICE_SLUGS = [
  "home-deep-cleaning",
  "sofa-carpet-mattress-cleaning",
  "kitchen-bathroom-cleaning",
  "window-floor-cleaning",
  "office-cleaning-housekeeping",
  "facility-management",
  "industrial-showroom-facade-cleaning",
  "post-interior-cleaning",
  "pest-control",
  "interior-painting",
  "exterior-painting",
] as const;

export const AREA_SLUGS = [
  "magarpatta", "hadapsar", "kharadi", "mundhwa", "manjri", "wagholi", "phursungi", "wakad", "baner",
  "balewadi", "hinjewadi", "sus", "pashan", "sutarwadi", "aundh", "pimple-saudagar", "pimple-nilakh",
  "bavdhan", "pimpri", "chinchwad", "bhosari", "viman-nagar", "kalyani-nagar", "koregaon-park", "yerwada",
  "dhanori", "vishrantwadi", "nibm", "kondhwa", "wanowrie", "undri", "mohammadwadi", "katraj", "dhankawadi",
  "bibwewadi", "balaji-nagar", "kothrud", "shivajinagar", "camp",
] as const;

// Legacy area names that have no page of their own in Sahara OS -> nearest area that does.
export const AREA_ALIASES: Record<string, string> = {
  "amanora-park": "hadapsar",
  "karve-nagar": "kothrud",
  "fursungi": "phursungi",
  "ambegaon": "katraj",
  "nigdi": "pimpri",
  "pcmc": "pimpri",
};

// Old WordPress pattern: /<prefix>-services-in-<area>
export const LEGACY_PREFIX_TO_SERVICE: Record<string, string> = {
  "cleaning": "home-deep-cleaning",
  "deep-cleaning": "home-deep-cleaning",
  "home-deep-cleaning": "home-deep-cleaning",
  "house-cleaning": "home-deep-cleaning",
  "bungalows-cleaning": "home-deep-cleaning",
  "housekeeping": "office-cleaning-housekeeping",
  "office-cleaning": "office-cleaning-housekeeping",
  "mattress-cleaning": "sofa-carpet-mattress-cleaning",
  "mattress-steam": "sofa-carpet-mattress-cleaning",
  "sofa-cleaning": "sofa-carpet-mattress-cleaning",
  "carpet-cleaning": "sofa-carpet-mattress-cleaning",
  "window-cleaning": "window-floor-cleaning",
  "bathroom-cleaning": "kitchen-bathroom-cleaning",
};
// "pune" = city level, goes to the service hub with no area.
export const LEGACY_IN_AREAS = [
  "pune", "undri", "amanora-park", "mohammadwadi", "kharadi", "hadapsar", "magarpatta", "viman-nagar",
  "baner", "wakad", "hinjewadi", "nibm", "kothrud", "pimple-saudagar",
];

// sahara-web pattern: /<segment>/<area>
export const SEGMENT_TO_SERVICE: Record<string, string> = {
  "deep-cleaning": "home-deep-cleaning",
  "pest-control": "pest-control",
  "painting-services": "interior-painting",
  "housekeeping": "office-cleaning-housekeeping",
  "commercial-cleaning": "office-cleaning-housekeeping",
};

// One-off legacy pages.
export const PAGE_MAP: Record<string, string> = {
  // 2026-11-02: "Balcony & Window Scrubbing" split into its own Window and Balcony pages.
  "/services/balcony-window-cleaning": "/services/window-cleaning",
  "/deep-cleaning-services": "/services/home-deep-cleaning",
  "/house-deep-cleaning": "/services/home-deep-cleaning",
  "/intensive-deep-cleaning": "/services/home-deep-cleaning",
  "/one-time-cleaning": "/services/home-deep-cleaning",
  "/residential-apartment-cleaning": "/services/home-deep-cleaning",
  "/move-in-move-out-cleaning": "/services/home-deep-cleaning",
  "/end-of-tenancy-cleaning": "/services/home-deep-cleaning",
  "/steam-cleaning": "/services/home-deep-cleaning",
  "/cleaning-services-baner-wakad": "/services/home-deep-cleaning/baner",
  "/sofa-cleaning-shampooing": "/services/sofa-carpet-mattress-cleaning",
  "/carpet-cleaning": "/services/sofa-carpet-mattress-cleaning",
  "/mattress-cleaning": "/services/sofa-carpet-mattress-cleaning",
  "/chair-cleaning-residential-commercial": "/services/sofa-carpet-mattress-cleaning",
  "/kitchen-cleaning": "/services/kitchen-bathroom-cleaning",
  "/bathroom-cleaning-service": "/services/kitchen-bathroom-cleaning",
  "/window-cleaning": "/services/window-floor-cleaning",
  "/corporate-office-cleaning": "/services/office-cleaning-housekeeping",
  "/commercial-deep-cleaning": "/commercial-cleaning-pune",
  "/post-construction-cleaning-pune": "/services/post-interior-cleaning",
  "/interior-painting-services-pune": "/interior-painting-pune",
  "/painting-services-pune": "/interior-painting-pune",
  "/rental-painting-pune": "/interior-painting-pune",
  "/commercial-painting-pune": "/interior-painting-pune",
  "/pest-control-services-pune": "/pest-control-pune",
  "/cockroach-control-pune": "/pest-control-pune",
  "/termite-treatment-pune": "/pest-control-pune",
  "/bed-bug-treatment-pune": "/pest-control-pune",
  "/pest-control-services-in-wakad": "/services/pest-control/wakad",
  "/pest-control-services-in-baner": "/services/pest-control/baner",
  "/pest-control-services-in-pcmc": "/services/pest-control/pimpri",
  // Pages with no Sahara OS equivalent: send to the services index rather than a 404.
  "/rent-agreement-pune": "/services",
  "/packers-and-movers-pune": "/services",
  "/property-desk-pune": "/services",
  "/more-services": "/services",
  "/video-gallery": "/gallery",
  "/photo-gallery": "/gallery",
  "/online-booking": "/booking",
  "/about": "/",
};

const resolveArea = (a: string) => AREA_ALIASES[a] ?? a;

export function buildLegacyRedirects(): LegacyRedirect[] {
  const out: LegacyRedirect[] = [];
  const add = (source: string, destination: string) => out.push({ source, destination, statusCode: 301 });

  for (const [source, destination] of Object.entries(PAGE_MAP)) add(source, destination);

  for (const [prefix, service] of Object.entries(LEGACY_PREFIX_TO_SERVICE)) {
    for (const area of LEGACY_IN_AREAS) {
      const dest = area === "pune" ? `/services/${service}` : `/services/${service}/${resolveArea(area)}`;
      add(`/${prefix}-services-in-${area}`, dest);
    }
  }

  const areaSources = [...AREA_SLUGS, ...Object.keys(AREA_ALIASES)];
  for (const [segment, service] of Object.entries(SEGMENT_TO_SERVICE)) {
    for (const area of areaSources) add(`/${segment}/${area}`, `/services/${service}/${resolveArea(area)}`);
  }
  return out;
}

export const LEGACY_REDIRECTS: LegacyRedirect[] = buildLegacyRedirects();

// Service renames (owner 2026-11-12): "Bathroom Scrubbing" -> "Bathroom Deep Cleaning", "Sofa & Upholstery Shampooing" -> "... Cleaning".
// Old and category-prefixed URLs 301 to the canonical /services/<slug> page. Listed before the generic category-prefix rule.
export const SERVICE_RENAME_REDIRECTS: LegacyRedirect[] = [
  // Requested B2B alias: the commercial hub is the category page.
  { source: "/services/commercial-cleaning", destination: "/services/commercial-services", statusCode: 301 },
  ...["/services/individual-services/bathroom-scrubbing", "/services/bathroom-scrubbing", "/services/individual-services/bathroom-deep-cleaning"].map((source) => ({ source, destination: "/services/bathroom-deep-cleaning", statusCode: 301 as const })),
  ...["/services/individual-services/sofa-upholstery-shampooing", "/services/sofa-upholstery-shampooing", "/services/individual-services/sofa-upholstery-cleaning"].map((source) => ({ source, destination: "/services/sofa-upholstery-cleaning", statusCode: 301 as const })),
];
