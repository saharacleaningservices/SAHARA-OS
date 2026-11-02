import type { MetadataRoute } from "next";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { PUNE_AREAS } from "@/lib/pune-areas";
import { PROGRAMMATIC_PAGES, SERVICE_CATEGORIES } from "@/config/pune-seo-matrix";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, servicePath } from "@/config/service-catalog";

// Public, canonical pages only (same paths as each page's canonical URL).
// Indexable package pages: 1–3 BHK × Premium/Platinum (4 BHK+ is inspection-only — no page).
// Same slug rule as packageSlug() in components/public/landing-kit.tsx.
const PACKAGE_PATHS = ["1-bhk", "2-bhk", "3-bhk"].flatMap((b) => ["premium", "platinum"].map((t) => `/home-deep-cleaning-pune/${b}-${t}`));
const CORE = ["/", "/offers", "/home-deep-cleaning-pune", ...PACKAGE_PATHS, "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/housekeeping-services", "/gallery", "/pune", ...PUNE_AREAS.map((a) => `/pune/${a.slug}`)];

// Pune SEO engine (2026-11-01): hub, one page per service, one page per service × locality, and the two B2B desks.
export const SEO_HUB_PATHS = ["/services", "/contact", ...SERVICE_CATEGORIES.map((c) => `/services/${c.slug}`), "/b2b/architects", "/b2b/corporate-facility"];
export const PROGRAMMATIC_PATHS = PROGRAMMATIC_PAGES.map((p) => `/services/${p.category}/${p.location}`);

// Service catalog pages (rebuild 2026-11-02). Slugs shared with a SEO hub above are de-duplicated.
export const CATALOG_PATHS = [...CATALOG_CATEGORIES.map((c) => `/services/${c.slug}`), ...CATALOG_SERVICES.map((s) => servicePath(s.slug))].filter((p) => !SEO_HUB_PATHS.includes(p));

export const SITEMAP_PATHS = [...CORE, "/scope-of-work", ...SEO_HUB_PATHS, ...CATALOG_PATHS, ...PROGRAMMATIC_PATHS];

// Read BOOKING_URL at request time (not frozen at build), so the sitemap always carries the live booking host.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return SITEMAP_PATHS.map((p) => {
    const programmatic = p.startsWith("/services/") && p.split("/").length === 4;
    return { url: `${PUBLIC_BOOKING_URL}${p}`, lastModified: now, changeFrequency: programmatic ? "monthly" : "weekly", priority: p === "/" ? 1 : programmatic ? 0.6 : p.startsWith("/b2b") || p.startsWith("/services") ? 0.8 : 0.7 };
  });
}
