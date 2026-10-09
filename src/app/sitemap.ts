import type { MetadataRoute } from "next";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

// Public, canonical pages only (same paths as each page's canonical URL).
const PATHS = ["/booking", "/offers", "/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/gallery"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${PUBLIC_BOOKING_URL}${p}` }));
}
