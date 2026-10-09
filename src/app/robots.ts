import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

export const dynamic = "force-dynamic";

// The booking host is the only public, indexable surface. Any other host (the
// CRM / legacy app host) is told not to crawl anything — CRM pages stay private.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  const bookingHost = new URL(PUBLIC_BOOKING_URL).host.toLowerCase();
  if (host !== bookingHost) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/j/", "/my", "/login", "/uploads/"] },
    sitemap: `${PUBLIC_BOOKING_URL}/sitemap.xml`,
  };
}
