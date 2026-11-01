import { SCHEMA_SITE, BUSINESS_GEO, breadcrumbJsonLd } from "@/lib/seo-schema";
import { CONTACT, GOOGLE_MAPS_URL } from "@/lib/marketing-content";
import { COMPANY } from "@/lib/constants";
import { TRUST } from "@/lib/booking-target";
import { BRANCHES, ZONES, branchForLocality, type Locality, type ServiceCategory } from "@/config/pune-seo-matrix";

// Dual-branch JSON-LD for the Pune SEO engine (2026-11-01).
//   Organization (one) ── parent of ──► LocalBusiness / HomeAndConstructionBusiness × 2 branches
//     Magarpatta City (Main-API line)  @id …/#business         (same node the rest of the site already emits)
//     Mohammadwadi    (Shoyab-GMB line) @id …/#branch-mohammadwadi
// Facts only (no prices, no "best" claims). Mohammadwadi has no street address / geo / rating of its own until the owner adds
// (read from Google Maps 2026-11-01, src/config/pune-seo-matrix.ts) — never copied from the Magarpatta node.

export const ORG_ID = `${SCHEMA_SITE}/#organization`;
export const MAGARPATTA_ID = `${SCHEMA_SITE}/#business`;
export const MOHAMMADWADI_ID = `${SCHEMA_SITE}/#branch-mohammadwadi`;

const tel = (n: string) => `+91${n}`;

export function organizationJsonLd(sameAs: string[] = []) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Sahara Cleaning Services",
    url: "https://www.saharacleaningservices.com",
    logo: `${SCHEMA_SITE}/brand/sahara-logo.png`,
    foundingDate: "2012",
    email: CONTACT.email,
    taxID: COMPANY.gstin,
    sameAs,
    contactPoint: [
      { "@type": "ContactPoint", telephone: tel(BRANCHES.magarpatta.phone), contactType: "customer service", name: "Magarpatta City branch", areaServed: "IN-MH", availableLanguage: ["English", "Hindi", "Marathi"] },
      { "@type": "ContactPoint", telephone: tel(BRANCHES.mohammadwadi.phone), contactType: "customer service", name: "Mohammadwadi branch", areaServed: "IN-MH", availableLanguage: ["English", "Hindi", "Marathi"] },
      { "@type": "ContactPoint", telephone: tel(TRUST.whatsappApi), contactType: "reservations", name: "WhatsApp booking assistant (messages only)", url: `https://wa.me/91${TRUST.whatsappApi}`, areaServed: "IN-MH" },
    ],
    subOrganization: [{ "@id": MAGARPATTA_ID }, { "@id": MOHAMMADWADI_ID }],
  };
}

/** Extra properties merged into the existing Magarpatta node (businessJsonLd) so it becomes a branch of the Organization. */
export const magarpattaBranchExtra = () => ({
  "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
  parentOrganization: { "@id": ORG_ID },
  branchOf: { "@id": ORG_ID },
  branchCode: "MAGARPATTA",
  hasMap: GOOGLE_MAPS_URL,
});

export function mohammadwadiBranchJsonLd() {
  const b = BRANCHES.mohammadwadi;
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": MOHAMMADWADI_ID,
    name: b.name,
    alternateName: b.gmbName,
    url: `${SCHEMA_SITE}/pune/mohammadwadi`,
    telephone: tel(b.phone),
    email: CONTACT.email,
    image: `${SCHEMA_SITE}/marketing/hero-home.webp`,
    parentOrganization: { "@id": ORG_ID },
    branchOf: { "@id": ORG_ID },
    branchCode: "MOHAMMADWADI",
    address: { "@type": "PostalAddress", ...(b.streetAddress ? { streetAddress: b.streetAddress } : {}), addressLocality: "Pune", postalCode: b.postalCode, addressRegion: "Maharashtra", addressCountry: "IN" },
    ...(b.geo ? { geo: { "@type": "GeoCoordinates", ...b.geo } } : {}),
    ...(b.mapsUrl ? { hasMap: b.mapsUrl } : {}),
    ...(b.plusCode ? { identifier: { "@type": "PropertyValue", propertyID: "Google Plus Code", value: b.plusCode } } : {}),
    ...(b.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: b.rating.value, bestRating: "5", worstRating: "1", ratingCount: b.rating.count, reviewCount: b.rating.count } } : {}),
    areaServed: [
      { "@type": "City", name: "Pune" },
      ...["Mohammadwadi", "Undri", "Kondhwa", "NIBM Road", "Wanowrie", "Katraj", "Kothrud", "Baner", "Wakad", "Hinjewadi", "Pimpri-Chinchwad"].map((n) => ({ "@type": "Place", name: `${n}, Pune` })),
    ],
    potentialAction: { "@type": "CommunicateAction", name: "Message on WhatsApp", target: { "@type": "EntryPoint", urlTemplate: `https://wa.me/91${b.whatsapp}` } },
    knowsAbout: ["Home deep cleaning", "Office and facility management", "Post-interior cleaning", "Pest control", "Interior and exterior painting"],
  };
}

/** The full set of nodes every SEO page ships: Organization + both branches (Magarpatta comes from businessJsonLd(magarpattaBranchExtra())). */
export function branchGraph() {
  return [organizationJsonLd(), mohammadwadiBranchJsonLd()];
}

/** Service node for one category in one locality, provided by the branch that covers that zone. */
export function seoServiceJsonLd(c: ServiceCategory, l: Locality, path: string) {
  const b = branchForLocality(l);
  const id = b.key === "magarpatta" ? MAGARPATTA_ID : MOHAMMADWADI_ID;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SCHEMA_SITE}${path}#service`,
    name: `${c.name} in ${l.name}, Pune`,
    serviceType: c.name,
    url: `${SCHEMA_SITE}${path}`,
    provider: { "@id": id },
    areaServed: [
      { "@type": "Place", name: `${l.name}, Pune`, address: { "@type": "PostalAddress", addressLocality: l.name, postalCode: l.pins[0], addressRegion: "Maharashtra", addressCountry: "IN" } },
      ...l.landmarks.slice(0, 3).map((n) => ({ "@type": "Place", name: n })),
    ],
    termsOfService: `${SCHEMA_SITE}/terms`,
  };
}

export function seoBreadcrumb(c: ServiceCategory, l: Locality, path: string) {
  return breadcrumbJsonLd([
    { name: "Home", path: "/booking" },
    { name: "Services", path: "/services" },
    { name: c.name, path: `/services/${c.slug}` },
    { name: `${c.short} in ${l.name}`, path },
  ]);
}

export const zoneLabel = (l: Locality) => ZONES[l.zone].label;
export { BUSINESS_GEO };
