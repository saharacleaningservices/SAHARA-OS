// External image CDN loader for next/image (Phase 2, 2026-11-02). Active ONLY when NEXT_PUBLIC_IMAGE_CDN is set at build time
// (next.config.ts switches `images.loader` to "custom"); otherwise Next's built-in optimiser is used exactly as before.
//
// Supported (choose one, set in Coolify → Environment, then redeploy):
//   ImageKit   NEXT_PUBLIC_IMAGE_CDN=imagekit   NEXT_PUBLIC_IMAGE_CDN_BASE=https://ik.imagekit.io/<your_id>
//              (ImageKit "Web Proxy" origin pointing at https://saharacleaningservices.com)
//   Cloudinary NEXT_PUBLIC_IMAGE_CDN=cloudinary NEXT_PUBLIC_IMAGE_CDN_BASE=https://res.cloudinary.com/<cloud>/image/fetch
//              (Cloudinary "fetch" delivery; allow the site domain under Security → Allowed fetch domains)
// The CDN fetches the original once from the site, then serves resized WebP/AVIF from its edge — zero resize CPU on the VPS.
// Pure function: unit-tested in tests/phase2-2026-11-02.test.ts.

const SITE = (process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://saharacleaningservices.com").replace(/\/$/, "");

export function cdnImageUrl(
  { src, width, quality }: { src: string; width: number; quality?: number },
  env: { kind?: string; base?: string } = { kind: process.env.NEXT_PUBLIC_IMAGE_CDN, base: process.env.NEXT_PUBLIC_IMAGE_CDN_BASE },
): string {
  const base = (env.base ?? "").replace(/\/$/, "");
  const q = quality ?? 75;
  if (!base || !env.kind) return src;
  const absolute = /^https?:\/\//.test(src) ? src : `${SITE}${src.startsWith("/") ? "" : "/"}${src}`;
  if (env.kind === "imagekit") {
    // Web-proxy origin: path-based URL keeps the original path; tr= sets width, quality and automatic WebP/AVIF.
    const path = absolute.startsWith(SITE) ? absolute.slice(SITE.length) : `/${absolute}`;
    return `${base}${path}?tr=w-${width},q-${q},f-auto`;
  }
  if (env.kind === "cloudinary") return `${base}/f_auto,q_${q},w_${width},c_limit/${encodeURIComponent(absolute)}`;
  return src;
}

export default function cdnLoader(p: { src: string; width: number; quality?: number }) {
  return cdnImageUrl(p);
}
