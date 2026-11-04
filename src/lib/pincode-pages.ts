// Pune pincode landing pages (owner-approved local SEO rollout, 2026-11-04): /cleaning-services-<locality>-<pincode>.
// Body HTML and per-page FAQ/Service JSON-LD come from docs/local-seo-paste-ready/pages (SAHARA-OS PR 113). No prices:
// every price mention links to /booking. Redirect data lives in ./pincode-redirects (loaded by next.config.ts).
import data from "./pincode-pages.json";

export { PINCODE_BATCH1, PINCODE_REDIRECTS, areaPath } from "./pincode-redirects";

export type PincodePage = { slug: string; title: string; description: string; body: string };

export const PINCODE_PAGES: PincodePage[] = data;

export const pincodePageBySlug = (slug: string) => PINCODE_PAGES.find((p) => p.slug === slug);

export const PINCODE_PATHS = PINCODE_PAGES.map((p) => `/${p.slug}`);
