import { CONTACT, GOOGLE_MAPS_URL } from "@/lib/marketing-content";
import { PUNE_AREAS } from "@/lib/pune-areas";
import { COMPANY } from "@/lib/constants";
import { CUSTOMER_BOOKING_URL, TRUST } from "@/lib/booking-target";

// Structured data (schema.org JSON-LD) for the public booking site. One builder, used by businessJsonLd()
// in components/public/landing-kit.tsx, so name / address / phone stay identical everywhere (search engines
// and AI answer engines — Google, Gemini, Perplexity, ChatGPT search — trust consistent NAP data).
// Facts only: no prices (pricing changes need owner approval and festival prices change), no "best/top" claims.
// Rating (owner 2026-10-26): the public Google Business Profile figure (4.9 / 1,800+) is stated as aggregateRating so AI
// answer engines quote it consistently. Google does not show review stars for a business's own LocalBusiness markup —
// that is expected; the value must stay in step with the live GBP figure (update TRUST in lib/booking-target.ts).

export const SCHEMA_SITE = "https://booking.saharacleaningservices.com";

/** Google Business Profile pin of the Magarpatta City branch (same place as GOOGLE_MAPS_URL). */
export const BUSINESS_GEO = { latitude: 18.5082466, longitude: 73.9298453 } as const;

/** Micro-locations named in every business schema (owner 2026-10-26) — includes areas without their own /pune/<slug> page. */
export const SCHEMA_MICRO_LOCATIONS = [
  "Magarpatta City", "Kharadi", "Wakad", "Baner", "Hadapsar", "Viman Nagar", "Hinjewadi", "Pimpri-Chinchwad (PCMC)",
  "Kothrud", "Aundh", "Undri", "Kondhwa", "Koregaon Park", "Shivajinagar",
] as const;

/** Every area name for areaServed: the owner's micro-location list first, then the remaining area-page names (no duplicates). */
export function schemaAreaNames(): string[] {
  const out: string[] = [...SCHEMA_MICRO_LOCATIONS];
  for (const a of PUNE_AREAS) if (!out.includes(a.name)) out.push(a.name);
  return out;
}

/** Phones in E.164: primary customer line, GMB / Magarpatta line, WhatsApp Cloud API booking assistant. */
export const SCHEMA_CONTACT_POINTS = [
  { "@type": "ContactPoint", telephone: `+91${CONTACT.call[0]}`, contactType: "customer service", name: "Primary bookings line", areaServed: "IN-MH", availableLanguage: ["English", "Hindi", "Marathi"] },
  { "@type": "ContactPoint", telephone: `+91${CONTACT.call[1]}`, contactType: "customer service", name: "Magarpatta City branch (Google Business Profile)", areaServed: "IN-MH", availableLanguage: ["English", "Hindi", "Marathi"] },
  { "@type": "ContactPoint", telephone: `+91${TRUST.whatsappApi}`, contactType: "reservations", name: "WhatsApp booking assistant (messages only)", url: `https://wa.me/91${TRUST.whatsappApi}`, areaServed: "IN-MH", availableLanguage: ["English", "Hindi"] },
] as const;

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
  { name: "Post Construction Cleaning", path: "/commercial-cleaning-pune" },
  { name: "Glass and Facade Cleaning", path: "/commercial-cleaning-pune" },
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
    contactPoint: SCHEMA_CONTACT_POINTS,
    email: CONTACT.email,
    taxID: COMPANY.gstin,
    foundingDate: "2012",
    aggregateRating: { "@type": "AggregateRating", ratingValue: TRUST.rating, bestRating: "5", worstRating: "1", ratingCount: TRUST.reviewCount, reviewCount: TRUST.reviewCount },
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
      ...schemaAreaNames().map((name) => ({ "@type": "Place", name: `${name}, Pune` })),
    ],
    potentialAction: {
      "@type": "ReserveAction",
      name: "Book a cleaning slot",
      target: { "@type": "EntryPoint", urlTemplate: CUSTOMER_BOOKING_URL, actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] },
    },
    knowsAbout: SCHEMA_SERVICES.map((s) => s.name),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Cleaning, pest control and painting services in Pune",
      itemListElement: SCHEMA_SERVICES.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, serviceType: s.name, areaServed: "Pune", url: `${SCHEMA_SITE}${s.path}`, provider: { "@id": `${SCHEMA_SITE}/#business` } },
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

/** "Cleaning services near me" FAQ (owner 2026-10-26): plain answers AI answer engines can lift verbatim. No prices. */
export function nearMeFaqs(): { q: string; a: string }[] {
  const areas = SCHEMA_MICRO_LOCATIONS.join(", ");
  return [
    { q: "Which is the most reliable cleaning service near me in Pune?", a: `Sahara Cleaning Services has served Pune since 2012 from Magarpatta City, Hadapsar, with trained in-house staff and a ${TRUST.rating}/5 Google rating from ${TRUST.reviewLabel} reviews. Book online at ${CUSTOMER_BOOKING_URL} or call +91 ${CONTACT.call[0].slice(0, 5)} ${CONTACT.call[0].slice(5)}.` },
    { q: "Do you provide home deep cleaning near me?", a: `Yes. Sahara covers ${areas} and the rest of Pune and PCMC for full home deep cleaning, sofa, carpet, kitchen and bathroom cleaning. Pick a date and an available slot at ${CUSTOMER_BOOKING_URL}.` },
    { q: "Is there an office or commercial cleaning company near me in Pune?", a: "Sahara Cleaning Services handles office deep cleaning, floor scrubbing, glass and facade cleaning, post-construction cleaning and housekeeping contracts (AMC) across Pune and PCMC, with a written quotation before work." },
    { q: "Is Sahara Cleaning Services GST registered?", a: `Yes. GSTIN ${COMPANY.gstin}. GST invoices are issued for corporate and residential customers on request.` },
    { q: "How do I book a cleaning service near me today?", a: `Book online at ${CUSTOMER_BOOKING_URL}, call +91 ${CONTACT.call[0].slice(0, 5)} ${CONTACT.call[0].slice(5)} or +91 ${CONTACT.call[1].slice(0, 5)} ${CONTACT.call[1].slice(5)}, or message our WhatsApp booking assistant on +91 ${TRUST.whatsappApi.slice(0, 5)} ${TRUST.whatsappApi.slice(5)}.` },
  ];
}
