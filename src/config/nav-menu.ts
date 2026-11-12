import { SERVICE_CATEGORIES, LEGACY_PATHS } from "@/config/pune-seo-matrix";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, servicesIn, servicePath, type CatalogCategoryId, type PricingMode } from "@/config/service-catalog";

// Header mega-menu (owner rebuild 2026-11-02): four categories — Residential, Individual, Commercial (B2B), Relocation & Property.
// Built from src/config/service-catalog.ts, so the menu, homepage grid, service pages and sitemap can never drift apart.
export type NavLeaf = { label: string; href: string; blurb: string; pricing: PricingMode };
export type NavMega = { id: CatalogCategoryId; label: string; short: string; blurb: string; /** Category landing page. */ href: string; items: NavLeaf[] };

/** Service pages kept live (and in the sitemap) but left out of the menus (owner 2026-11-03: Move-in / Move-out). */
export const NAV_HIDDEN: ReadonlySet<string> = new Set(["move-in-move-out-cleaning"]);

/** Extra menu links that are not catalog service pages (owner 2026-11-03: Housekeeping Services under Commercial). */
const NAV_EXTRA: Partial<Record<CatalogCategoryId, NavLeaf[]>> = {
  commercial: [{ label: "Request Site Visit & B2B Quote", href: "/b2b/corporate-facility", blurb: "Offices, IT parks, societies, factories, hospitals — free site visit and written quote", pricing: "inspection" }, { label: "Housekeeping Services", href: "/housekeeping-services", blurb: "Trained housekeeping staff on daily, weekly or AMC contract", pricing: "inspection" }],
};

export const NAV_MEGA: NavMega[] = CATALOG_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  short: c.short,
  href: `/services/${c.slug}`,
  blurb: c.blurb,
  items: [
    ...servicesIn(c.id).filter((s) => !NAV_HIDDEN.has(s.slug)).map((s) => ({ label: s.name, href: servicePath(s.slug), blurb: s.blurb, pricing: s.pricing.mode })),
    ...(NAV_EXTRA[c.id] ?? []),
  ],
}));

/** All distinct hrefs the menu can emit — used by tests to prove no menu link points at a missing route. */
export const NAV_HREFS = Array.from(new Set(NAV_MEGA.flatMap((m) => [m.href, ...m.items.map((i) => i.href)])));

export const isKnownNavHref = (href: string) =>
  href.startsWith("/b2b/") ||
  (LEGACY_PATHS as readonly string[]).includes(href) ||
  SERVICE_CATEGORIES.some((c) => href === `/services/${c.slug}`) ||
  CATALOG_SERVICES.some((s) => href === servicePath(s.slug)) ||
  CATALOG_CATEGORIES.some((c) => href === `/services/${c.slug}`);
