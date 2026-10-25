import { HOME_BASE_SCOPE, OFFICE_SCOPE, PAINT_SCOPE, PEST_SERVICES } from "@/lib/marketing-content";

// Content for the four Google Ads landing pages (/landing/<slug>). Each page is
// 100% one service — nothing here mentions or links to another service. Scope text
// is reused from the approved marketing content (marketing-content.ts); no prices
// are typed here (home prices come live from the pricing master).

export type PpcIcon =
  | "window" | "sofa" | "bath" | "kitchen" | "balcony" | "fan" | "floor" | "cobweb" | "wall"
  | "desk" | "glass" | "building"
  | "ruler" | "prep" | "layers" | "roller" | "finish" | "shield"
  | "bug";

export type PpcConfig = {
  slug: "home-deep-cleaning-pune" | "office-commercial-cleaning-pune" | "pest-control-services-pune" | "interior-painting-pune";
  /** CRM serviceCategory + gallery filter token + campaign tag. */
  service: "HOME_DEEP_CLEANING" | "COMMERCIAL_CLEANING" | "PEST_CONTROL" | "PAINTING";
  serviceLabel: string;
  galleryCategory: string;
  campaignName: string;
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  image: string;
  alt: string;
  formTitle: string;
  formNote: string | null;
  /** Third trust line — only the home page has fixed package prices. */
  pricingLine: string;
  includedHeading: string;
  included: { icon: PpcIcon; text: string }[];
  steps: [string, string, string];
  waText: string;
  fixedPrices: boolean;
};

const HOME_ICONS: PpcIcon[] = ["window", "sofa", "bath", "kitchen", "balcony", "fan", "floor", "cobweb"];
const PAINT_ICONS: PpcIcon[] = ["ruler", "prep", "layers", "layers", "roller", "finish"];
const OFFICE_ICONS: PpcIcon[] = ["desk", "glass", "floor", "bath", "building"];

export const PPC_PAGES: Record<PpcConfig["slug"], PpcConfig> = {
  "home-deep-cleaning-pune": {
    slug: "home-deep-cleaning-pune",
    service: "HOME_DEEP_CLEANING",
    serviceLabel: "Home Deep Cleaning",
    galleryCategory: "Home",
    campaignName: "PPC Home Deep Cleaning Pune",
    title: "Home Deep Cleaning in Pune — Fixed Prices, Pay After Service",
    subtitle: "Top-to-bottom deep cleaning of your home by Sahara's own trained team. Pick your size, see the price, get a call back in minutes.",
    metaTitle: "Home Deep Cleaning in Pune – Fixed Prices | Sahara Cleaning Services",
    metaDescription: "Professional home deep cleaning in Pune & PCMC with transparent fixed package prices. Get an instant quote or a call back.",
    image: "/marketing/hero-home.webp",
    alt: "Sahara team deep cleaning a home in Pune",
    formTitle: "Get Instant Quote / Call Back",
    formNote: null,
    pricingLine: "Pay After Service | Transparent Fixed Pricing",
    includedHeading: "What's included in your home deep clean",
    included: [...HOME_BASE_SCOPE.map((text, i) => ({ icon: HOME_ICONS[i] ?? ("wall" as PpcIcon), text })), { icon: "wall" as PpcIcon, text: "Wall & ceiling dusting (Platinum adds wall wet cleaning)" }],
    steps: ["Book Slot", "Team Arrives & Cleans", "Pay After Inspection"],
    waText: "Hi Sahara, I'd like an instant quote for home deep cleaning.",
    fixedPrices: true,
  },
  "office-commercial-cleaning-pune": {
    slug: "office-commercial-cleaning-pune",
    service: "COMMERCIAL_CLEANING",
    serviceLabel: "Office & Commercial Cleaning",
    galleryCategory: "Commercial",
    campaignName: "PPC Commercial Cleaning Pune",
    title: "Office & Commercial Cleaning in Pune",
    subtitle: "Professional office deep cleaning and floor scrubbing by trained, uniformed staff. Free site visit and a clear written quote before work starts.",
    metaTitle: "Office & Commercial Cleaning in Pune – Free Site Visit | Sahara Cleaning Services",
    metaDescription: "Office and commercial cleaning across Pune & PCMC: workstations, glass, floors, pantry and washrooms. Free site visit and written quote.",
    image: "/marketing/hero-commercial-v2.webp",
    alt: "Sahara cleaning team scrubbing floors and cleaning glass in a Pune office",
    formTitle: "Get Instant Quote / Call Back",
    formNote: "Every site is different — we visit, confirm the scope and send a clear written quote before work starts.",
    pricingLine: "Pay After Service | Clear Written Quote Before Work",
    includedHeading: "What's included in office cleaning",
    included: OFFICE_SCOPE.map((text, i) => ({ icon: OFFICE_ICONS[i] ?? ("building" as PpcIcon), text })),
    steps: ["Book Site Visit", "Team Arrives & Cleans", "Pay After Inspection"],
    waText: "Hi Sahara, I'd like a quote for office / commercial cleaning.",
    fixedPrices: false,
  },
  "pest-control-services-pune": {
    slug: "pest-control-services-pune",
    service: "PEST_CONTROL",
    serviceLabel: "Pest Control",
    galleryCategory: "Pest",
    campaignName: "PPC Pest Control Pune",
    title: "Pest Control in Pune — Inspection First, Targeted Treatment",
    subtitle: "Cockroach, termite and bed bug control by trained technicians. We inspect, explain the plan and share a clear quote before any treatment.",
    metaTitle: "Pest Control Services in Pune – Book Inspection | Sahara Cleaning Services",
    metaDescription: "Pest control in Pune & PCMC: cockroach, termite and bed bug treatment after inspection. Instant quote or call back.",
    image: "/marketing/service-pest-control.webp",
    alt: "Sahara pest control technician treating a kitchen in a Pune apartment",
    formTitle: "Get Instant Quote / Call Back",
    formNote: "Price depends on the pest and infestation level — we inspect first and share the treatment plan and quote.",
    pricingLine: "Pay After Service | Clear Written Quote Before Work",
    includedHeading: "What we treat",
    included: PEST_SERVICES.filter((p) => /cockroach|termite|bed bug/i.test(p.name)).map((p) => ({ icon: "bug" as PpcIcon, text: `${p.name} — ${p.desc}` })),
    steps: ["Book Inspection", "Team Arrives & Treats", "Pay After Inspection"],
    waText: "Hi Sahara, I'd like a quote for pest control.",
    fixedPrices: false,
  },
  "interior-painting-pune": {
    slug: "interior-painting-pune",
    service: "PAINTING",
    serviceLabel: "Interior Painting",
    galleryCategory: "Paint",
    campaignName: "PPC Interior Painting Pune",
    title: "Interior Painting in Pune — Free Site Inspection",
    subtitle: "Neat interior painting by Sahara's trained team using the Asian Paints range. Free site visit, measurement and a clear written quote.",
    metaTitle: "Interior Painting in Pune – Free Site Inspection | Sahara Cleaning Services",
    metaDescription: "Interior painting in Pune & PCMC with a free site inspection and measurement-based quote. Get a call back today.",
    image: "/marketing/service-painting.webp",
    alt: "Sahara painting team painting an interior wall in Pune",
    formTitle: "Get Instant Quote / Call Back",
    formNote: "Painting is quoted after a free site inspection and measurement — no obligation.",
    pricingLine: "Pay After Service | Clear Written Quote Before Work",
    includedHeading: "What a painting job includes",
    included: PAINT_SCOPE.map((text, i) => ({ icon: PAINT_ICONS[i] ?? ("finish" as PpcIcon), text })),
    steps: ["Book Free Inspection", "Team Arrives & Paints", "Pay After Inspection"],
    waText: "Hi Sahara, I'd like a free site inspection for interior painting.",
    fixedPrices: false,
  },
};
