import { ZONES } from "@/config/pune-seo-matrix";

/**
 * Complete B2C + B2B coverage list (owner 2026-11-12) for classic SEO and AI search (ChatGPT, Gemini, Perplexity, Claude).
 * Every entry points at a real page; tests fail if one stops existing. Rendered as a "What we clean" section and emitted as
 * schema.org OfferCatalog with areaServed across East, West, North, South, Central Pune and PCMC.
 */
export type CoverageItem = { name: string; href: string; note: string };

export const B2C_COVERAGE: CoverageItem[] = [
  { name: "1–4 BHK Flat Cleaning", href: "/services/home-deep-cleaning", note: "Fixed 1, 2 and 3 BHK rates; 4 BHK and larger on inspection" },
  { name: "Bungalow Cleaning", href: "/services/home-deep-cleaning", note: "Multi-floor bungalows and villas" },
  { name: "Row House Cleaning", href: "/services/home-deep-cleaning", note: "Row houses and independent homes" },
  { name: "Penthouse Cleaning", href: "/services/home-deep-cleaning", note: "Large duplex and penthouse homes" },
  { name: "Residential Post-Interior Deep Cleaning", href: "/services/post-interior-cleaning", note: "After carpentry, false ceiling and painting" },
  { name: "Bathroom Deep Cleaning", href: "/services/bathroom-deep-cleaning", note: "Descaling of tiles, grout, WC and fittings" },
  { name: "Kitchen Deep Cleaning", href: "/services/kitchen-deep-cleaning", note: "Degreasing of platform, tiles, cabinets and exhaust" },
  { name: "Sofa & Upholstery Cleaning", href: "/services/sofa-upholstery-cleaning", note: "Extraction shampooing of fabric sofas and chairs" },
  { name: "Carpet Cleaning", href: "/services/carpet-cleaning", note: "Shampooing and extraction of rugs and carpets" },
  { name: "Mattress Cleaning", href: "/services/sofa-carpet-mattress-cleaning", note: "Vacuum, shampoo and extraction" },
  { name: "Window Cleaning", href: "/services/window-cleaning", note: "Glass, grills and sliding channels, per window" },
  { name: "Balcony Cleaning", href: "/services/balcony-cleaning", note: "Floor scrubbing, railings and grills" },
  { name: "Interior Painting", href: "/services/interior-painting", note: "Free site inspection and written quote" },
  { name: "Pest Control", href: "/services/pest-control", note: "Cockroach, termite, bed bug, ant and rodent" },
];

export const B2B_COVERAGE: CoverageItem[] = [
  { name: "Office Deep Cleaning", href: "/services/office-cleaning-housekeeping", note: "One-time deep clean or daily housekeeping" },
  { name: "Office Carpet & Chair Shampooing", href: "/services/office-cleaning-housekeeping", note: "Workstation carpets and chairs" },
  { name: "Showroom Cleaning", href: "/services/showroom-cleaning", note: "Display floors, glass and fixtures" },
  { name: "Warehouse & Industrial Cleaning", href: "/services/warehouse-cleaning", note: "Large floors, racks and loading bays" },
  { name: "Hospital & Clinic Sanitisation", href: "/services/facility-management", note: "Housekeeping and sanitisation staffing" },
  { name: "Restaurant & Commercial Kitchen Cleaning", href: "/services/restaurant-kitchen-cleaning", note: "Hood, equipment, floor and drain degreasing" },
  { name: "School, College & Institute Cleaning", href: "/services/facility-management", note: "Campus housekeeping contracts" },
  { name: "IT Park Cleaning", href: "/services/office-cleaning-housekeeping", note: "Floors, workstations, pantries and washrooms" },
  { name: "Commercial Post-Interior Deep Cleaning", href: "/services/post-construction-cleaning", note: "Handover cleaning for builders and designers" },
  { name: "Society, Office, Hospital & Hotel Housekeeping Staffing", href: "/services/facility-management", note: "Housekeeping staff and soft services on contract (AMC)" },
  { name: "Facade & Glass Cleaning", href: "/services/facade-glass-cleaning", note: "Exterior glass and cladding" },
];

/** areaServed for every Service node: the five Pune zones plus PCMC (zones come from the SEO matrix, so they stay in sync). */
export const AREA_SERVED_JSONLD = [
  { "@type": "City", name: "Pune" },
  { "@type": "City", name: "Pimpri-Chinchwad" },
  ...Object.values(ZONES).map((z) => ({ "@type": "AdministrativeArea", name: z.label })),
  { "@type": "AdministrativeArea", name: "Central Pune" },
];

const abs = (origin: string, href: string) => `${origin}${href}`;

export function coverageJsonLd(origin: string) {
  const offer = (i: CoverageItem) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: i.name, description: i.note, url: abs(origin, i.href), areaServed: AREA_SERVED_JSONLD } });
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${origin}/services#coverage`,
    name: "Residential and commercial cleaning, facility management, pest control and painting",
    serviceType: "Cleaning and facility services",
    provider: { "@type": "LocalBusiness", name: "Sahara Cleaning Services", url: origin },
    areaServed: AREA_SERVED_JSONLD,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Sahara service catalog",
      itemListElement: [
        { "@type": "OfferCatalog", name: "Residential (B2C)", itemListElement: B2C_COVERAGE.map(offer) },
        { "@type": "OfferCatalog", name: "Commercial & Facility Management (B2B)", itemListElement: B2B_COVERAGE.map(offer) },
      ],
    },
  };
}
