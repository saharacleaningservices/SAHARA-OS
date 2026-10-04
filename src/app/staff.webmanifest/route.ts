// Installable "Sahara Staff" PWA manifest — separate from the office CRM
// manifest (src/app/manifest.ts) so staff get their own home-screen app that
// opens straight into /my. Public (see middleware isStaticAssetPath): browsers
// fetch manifests without cookies.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id: "/my",
      name: "Sahara Staff",
      short_name: "Sahara Staff",
      description: "Sahara Cleaning Services staff app — jobs, attendance, salary and announcements.",
      start_url: "/my",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#0B5ED7",
      icons: [
        { src: "/brand/staff-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/brand/staff-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/brand/staff-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
