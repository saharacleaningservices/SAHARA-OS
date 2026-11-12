import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

export const dynamic = "force-dynamic";

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** Search and AI crawlers named explicitly so no future wildcard rule can lock them out (SEO + AI search / GEO). */
export const ALLOWED_BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"] as const;
export const PRIVATE_PATHS = ["/api/", "/j/", "/my", "/login", "/uploads/"];

// The public website host (apex or its www twin) is the only indexable surface. Any other host (the CRM / legacy app host)
// is told not to crawl anything — CRM pages stay private.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const bookingHost = new URL(PUBLIC_BOOKING_URL).host.toLowerCase();
  if (bare(host) !== bare(bookingHost)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      ...ALLOWED_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE_PATHS })),
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${PUBLIC_BOOKING_URL}/sitemap.xml`,
    host: PUBLIC_BOOKING_URL,
  };
}
