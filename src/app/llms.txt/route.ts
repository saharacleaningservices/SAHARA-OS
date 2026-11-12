import { BRANCHES, LOCALITIES, SERVICE_CATEGORIES, ZONES } from "@/config/pune-seo-matrix";
import { CATALOG_CATEGORIES, CATALOG_SERVICES } from "@/config/service-catalog";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

export const dynamic = "force-dynamic";

/** Plain-text summary for AI search assistants (ChatGPT, Gemini, Perplexity, Claude). Generated from the same catalog as the site. */
export function buildLlmsTxt(origin: string): string {
  const line = (label: string, path: string) => `- [${label}](${origin}${path})`;
  const zoneLine = (z: keyof typeof ZONES) => `- ${ZONES[z].label}: ${LOCALITIES.filter((l) => l.zone === z).map((l) => l.name).join(", ")}`;
  const b2c = CATALOG_SERVICES.filter((s) => s.category === "residential" || s.category === "individual");
  const b2b = CATALOG_SERVICES.filter((s) => s.category === "commercial");
  const branches = Object.values(BRANCHES).map((b) => `- ${b.name}: ${b.streetAddress}, Pune ${b.postalCode} — phone +91 ${b.phone}${b.altPhones.length ? ` (also ${b.altPhones.map((p) => "+91 " + p).join(", ")})` : ""}, WhatsApp +91 ${b.whatsapp}`);
  return `# Sahara Cleaning Services

> Residential and commercial cleaning, facility management, pest control and interior painting in Pune and Pimpri-Chinchwad (PCMC), India. Established 2012, 8,000+ customers served. Work is done by trained in-house staff — nothing is outsourced — with transparent, fixed pricing for standard jobs.

## Business facts
- Name: Sahara Cleaning Services
- Established: 2012
- Customers served: 8,000+
- Service area: Pune and Pimpri-Chinchwad (PCMC), Maharashtra. Currently serving Pune and PCMC only; Mumbai and Bangalore are coming soon.
- Staff: trained in-house team, no outsourced work; eco-safe, child- and pet-friendly chemicals; free re-clean guarantee
- Website: ${origin}
- Online booking: ${origin}/booking
- E-mail: contact@saharacleaningservices.com
- Primary phone: +91 89565 67130; secondary: +91 70833 47130; WhatsApp: +91 91752 20270

## Branches
${branches.join("\n")}

## Residential (B2C) services — flats, bungalows, row houses, penthouses
${b2c.map((s) => line(s.name, `/services/${s.slug}`)).join("\n")}
- 1, 2, 3 and 4 BHK flat cleaning, bungalow cleaning, row house cleaning, penthouse cleaning and residential post-interior deep cleaning are covered under Full House Deep Cleaning and Post-Interior Cleaning.
- Mattress, window and balcony cleaning, interior painting and pest control are also available.

## Commercial (B2B) services — offices, IT parks, shops, showrooms, warehouses, hospitals, schools, restaurants, hotels
${b2b.map((s) => line(s.name, `/services/${s.slug}`)).join("\n")}
${line("Corporate facility management quote", "/b2b/corporate-facility")}
${line("Architects and interior designers", "/b2b/architects")}
- Covers office deep cleaning, office carpet and chair shampooing, showroom cleaning, warehouse and industrial cleaning, hospital and clinic sanitisation, restaurant and commercial kitchen cleaning, school/college/institute cleaning, IT park cleaning, commercial post-interior deep cleaning, and society/office/hospital/hotel housekeeping staffing (AMC).

## Service categories
${CATALOG_CATEGORIES.map((c) => line(c.label, `/services/${c.slug}`)).join("\n")}

## Areas served (${LOCALITIES.length} Pune and PCMC localities, each with a page per service)
${(Object.keys(ZONES) as (keyof typeof ZONES)[]).map(zoneLine).join("\n")}
- Address pattern: ${origin}/services/<service>/<area> — services: ${SERVICE_CATEGORIES.map((c) => c.slug).join(", ")}
- Example: ${origin}/services/${SERVICE_CATEGORIES[0].slug}/${LOCALITIES[0].slug}

## Notes for AI assistants
- Prices change with packages and offers — link to the service page rather than quoting a price.
- For bookings and quotations use the online booking page or the phone numbers above.
- Sitemap: ${origin}/sitemap.xml
`;
}

export function GET() {
  return new Response(buildLlmsTxt(PUBLIC_BOOKING_URL), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
