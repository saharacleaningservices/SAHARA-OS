import type { MetadataRoute } from "next";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { PUNE_AREAS } from "@/lib/pune-areas";

// Public, canonical pages only (same paths as each page's canonical URL).
// Indexable package pages: 1–3 BHK × Premium/Platinum (4 BHK+ is inspection-only — no page).
// Same slug rule as packageSlug() in components/public/landing-kit.tsx.
const PACKAGE_PATHS = ["1-bhk", "2-bhk", "3-bhk"].flatMap((b) => ["premium", "platinum"].map((t) => `/home-deep-cleaning-pune/${b}-${t}`));
const PATHS = ["/booking", "/offers", "/home-deep-cleaning-pune", ...PACKAGE_PATHS, "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/housekeeping-services", "/gallery", "/pune", ...PUNE_AREAS.map((a) => `/pune/${a.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${PUBLIC_BOOKING_URL}${p}` }));
}
