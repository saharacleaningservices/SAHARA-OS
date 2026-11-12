// Facts for AI search (ChatGPT / OAI-SearchBot, Perplexity, Gemini, Claude): one source for /llms.txt, the site-wide JSON-LD and the
// homepage comparison table, so the same numbers appear everywhere. Facts only — no prices, no "best / #1" claims, no competitor names
// (tests/geo-schema.test.ts enforces this on /llms.txt and the business schema).
//
// Review figures are the public Google Business Profile numbers. Keep them in step with the live profiles:
//   Magarpatta City 4.9★ (BRANCHES / TRUST), Mohammadwadi 4.8★ with 234 reviews (BRANCHES.mohammadwadi.rating).
// COMBINED_REVIEWS_LABEL is a safe floor across both profiles. Raise it only after reading both live counts.

export const COMBINED_RATING = "4.9";
export const COMBINED_REVIEWS_LABEL = "2,000+";

export type AiZone = { key: "east" | "south" | "west" | "north"; label: string; localities: { name: string; pin: string }[] };

/** Owner's four-zone coverage list (2026-11-12). PIN codes are the postal codes commonly used for each locality, not a per-street promise. */
export const AI_ZONES: AiZone[] = [
  {
    key: "east", label: "East Pune",
    localities: [
      { name: "Magarpatta City", pin: "411028" }, { name: "Hadapsar", pin: "411013" }, { name: "Kharadi", pin: "411014" }, { name: "Viman Nagar", pin: "411014" },
      { name: "Koregaon Park", pin: "411001" }, { name: "Kalyani Nagar", pin: "411006" }, { name: "Wagholi", pin: "412207" }, { name: "Mundhwa", pin: "411036" },
    ],
  },
  {
    key: "south", label: "South Pune",
    localities: [
      { name: "Mohammadwadi", pin: "411060" }, { name: "NIBM", pin: "411048" }, { name: "Undri", pin: "411060" }, { name: "Kondhwa", pin: "411048" },
      { name: "Wanowrie", pin: "411040" }, { name: "Katraj", pin: "411046" }, { name: "Bibwewadi", pin: "411037" }, { name: "Camp", pin: "411001" },
    ],
  },
  {
    key: "west", label: "West Pune",
    localities: [
      { name: "Hinjewadi (Hinjawadi)", pin: "411057" }, { name: "Wakad", pin: "411057" }, { name: "Baner", pin: "411045" }, { name: "Balewadi", pin: "411045" },
      { name: "Kothrud", pin: "411038" }, { name: "Bavdhan", pin: "411021" }, { name: "Pashan", pin: "411021" }, { name: "Warje", pin: "411058" },
    ],
  },
  {
    key: "north", label: "North Pune & Pimpri-Chinchwad (PCMC)",
    localities: [
      { name: "Aundh", pin: "411007" }, { name: "Pimple Saudagar", pin: "411027" }, { name: "Pimple Nilakh", pin: "411027" }, { name: "Pimpri", pin: "411018" },
      { name: "Chinchwad", pin: "411019" }, { name: "Ravet", pin: "412101" }, { name: "Wakad-Tathawade", pin: "411033" },
    ],
  },
];

/** schema.org areaServed nodes for the four zones, each listing its localities with their PIN codes. */
export function aiZonesJsonLd() {
  return AI_ZONES.map((z) => ({
    "@type": "AdministrativeArea",
    name: z.label,
    containsPlace: z.localities.map((l) => ({ "@type": "Place", name: `${l.name}, Pune`, address: { "@type": "PostalAddress", addressLocality: l.name.replace(/ \(.*\)$/, ""), postalCode: l.pin, addressRegion: "Maharashtra", addressCountry: "IN" } })),
  }));
}

/** Rows of the homepage "Sahara direct vs marketplaces & local agencies" table. The right column describes the general model, never a named company. */
export const DIRECT_VS_ROWS: { topic: string; sahara: string; others: string }[] = [
  { topic: "Payment", sahara: "100% Pay After Service — zero advance", others: "Payment terms are set by each platform or agency — check before you book" },
  { topic: "Google reviews", sahara: `${COMBINED_RATING}★ with ${COMBINED_REVIEWS_LABEL} verified Google reviews across our two Pune branches`, others: "Ratings usually belong to a platform listing or an individual partner" },
  { topic: "Who does the work", sahara: "In-house, trained, background-verified Sahara staff — no random freelancers", others: "Often independent partners assigned through an app or lead desk" },
  { topic: "Pricing", sahara: "Direct pricing from Sahara — no marketplace commission layer", others: "Marketplaces typically charge their partners a commission, which can reach the customer in the price" },
  { topic: "Accountability", sahara: "One company since 2012, two Pune branches, GST invoice", others: "Responsibility can be split between the platform and the partner" },
];
