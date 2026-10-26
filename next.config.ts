import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), interest-cohort=()" },
  // HSTS only matters over HTTPS (which Render terminates for us); harmless
  // no-op locally over http.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Identifies this build. It is inlined into both the server and the browser bundles, so an already-open CRM tab
// can tell (via /api/notifications/feed) that a newer deployment exists and reload itself — see notifications-bell.tsx.
const BUILD_ID = (process.env.SOURCE_COMMIT || "").slice(0, 12) || String(Date.now());

const STATIC_IMAGE_DIRS = ["brand", "marketing", "logo"] as const;
const STATIC_IMAGE_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Short legal URL some links and ad forms use. 308 = permanent, method-preserving.
  async redirects() {
    return [{ source: "/privacy", destination: "/privacy-policy", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Brand + marketing images in /public were served with max-age=0 (re-validated on every page view).
      // File names are not content-hashed, so keep it short: 1 day fresh, then served stale while refreshing.
      // Not applied to /uploads (customer/staff files) or /sw.js (service worker must always be fresh).
      ...STATIC_IMAGE_DIRS.map((dir) => ({
        source: `/${dir}/:path*`,
        headers: [{ key: "Cache-Control", value: STATIC_IMAGE_CACHE }],
      })),
    ];
  },
};

export default nextConfig;
