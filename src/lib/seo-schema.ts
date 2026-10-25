import { CONTACT, GOOGLE_MAPS_URL } from "@/lib/marketing-content";
import { PUNE_AREAS } from "@/lib/pune-areas";

// Structured data (schema.org JSON-LD) for the public booking site. One builder, used by businessJsonLd()
// in components/public/landing-kit.tsx, so name / address / phone stay identical everywhere (search engines
// and AI answer engines — Google, Gemini, Perplexity, ChatGPT search — trust consistent NAP data).
// Facts only: no prices (pricing changes need owner approval and festival prices change), no self-published
// ratings (not eligible for Google review rich results), no "best/top" claims.

export const SCHEMA_SITE = "https://booking.saharacleaningservices.com";

/** Google Business Profile pin of the Magarpatta City branch (same place as GOOGLE_MAPS_URL). */
export const BUSINESS_GEO = { latitude: 18.5082466, longitude: 73.9298453 } as const;

/** Services Sahara offers, each with its public page. Names match the pricing master / service labels. */
export const SCHEMA_SERVICES = [
  { name: "Home Deep Cleaning", path: "/home-deep-cleaning-pune" },
  { name: "Sofa Cleaning", path: "/home-deep-cleaning-pune" },
  { name: "Kitchen Deep Cleaning", path: "/home-deep-cleaning-pune" },
  { name: "Bathroom Deep Cleaning", path: "/home-deep-cleaning-pune" },
  { name: "Mattress and Carpet Cleaning", path: "/home-deep-cleaning-pune" },
  { name: "Office and Commercial Cleaning", path: "/commercial-cleaning-pune" },
  { name: "Residential and Commercial Housekeeping", path: "/housekeeping-services" },
  { name: "Facility Management and Housekeeping AMC (offices, residential societies, commercial complexes)", path: "/housekeeping-services" },
  { name: "Termite Control", path: "/pest-control-pune" },
  { name: "Cockroach Control", path: "/pest-control-pune" },
  { name: "Bed Bug Treatment", path: "/pest-control-pune" },
  { name: "Ant Control", path: "/pest-control-pune" },
  { name: "Interior Painting", path: "/interior-painting-pune" },
  { name: "Texture Painting", path: "/interior-painting-pune" },
] as const;

export function buildBusinessJsonLd({ sameAs = [], extra = {} }: { sameAs?: string[]; extra?: Record<string, unknown> } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${SCHEMA_SITE}/#business`,
    name: "Sahara Cleaning Services",
    slogan: "Serving Pune Since 2012",
    description:
      "Home deep cleaning, sofa and kitchen cleaning, office and commercial cleaning, housekeeping and facility management (AMC), pest control (termite, cockroach, bed bug) and interior painting across Pune and Pimpri-Chinchwad (PCMC). Trained in-house staff; serving Pune since 2012.",
    url: "https://www.saharacleaningservices.com",
    logo: `${SCHEMA_SITE}/brand/sahara-logo.png`,
    image: `${SCHEMA_SITE}/marketing/hero-home.webp`,
    telephone: CONTACT.call.map((n) => `+91${n}`),
    email: CONTACT.email,
    foundingDate: "2012",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Opposite South Gate, Magarpatta City, Hadapsar",
      addressLocality: "Pune",
      postalCode: "411028",
      addressRegion: "Maharashtra",
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", ...BUSINESS_GEO },
    hasMap: GOOGLE_MAPS_URL,
    areaServed: [
      { "@type": "City", name: "Pune" },
      { "@type": "City", name: "Pimpri-Chinchwad" },
      ...PUNE_AREAS.map((x) => ({ "@type": "Place", name: `${x.name}, Pune` })),
    ],
    knowsAbout: SCHEMA_SERVICES.map((s) => s.name),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Cleaning, pest control and painting services in Pune",
      itemListElement: SCHEMA_SERVICES.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, areaServed: "Pune", url: `${SCHEMA_SITE}${s.path}` },
      })),
    },
    sameAs,
    ...extra,
  };
}

/** Service JSON-LD for one service in one Pune area (provider points at the business @id so NAP stays in one place). */
export function areaServiceJsonLd(service: string, path: string, area: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service} in ${area}, Pune`,
    serviceType: service,
    url: `${SCHEMA_SITE}${path}`,
    provider: { "@type": "HomeAndConstructionBusiness", "@id": `${SCHEMA_SITE}/#business`, name: "Sahara Cleaning Services", telephone: CONTACT.call.map((n) => `+91${n}`) },
    areaServed: { "@type": "Place", name: `${area}, Pune` },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SCHEMA_SITE}${it.path}` })),
  };
}
