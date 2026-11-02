import { SERVICE_CATEGORIES, LEGACY_PATHS } from "@/config/pune-seo-matrix";
import { CATALOG_CATEGORIES, CATALOG_SERVICES, servicesIn, servicePath, type CatalogCategoryId, type PricingMode } from "@/config/service-catalog";

// Header mega-menu (owner rebuild 2026-11-02): four categories — Residential, Individual, Commercial (B2B), Relocation & Property.
// Built from src/config/service-catalog.ts, so the menu, homepage grid, service pages and sitemap can never drift apart.
export type NavLeaf = { label: string; href: string; blurb: string; pricing: PricingMode };
export type NavMega = { id: CatalogCategoryId; label: string; short: string; blurb: string; items: NavLeaf[] };

export const NAV_MEGA: NavMega[] = CATALOG_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  short: c.short,
  blurb: c.blurb,
  items: servicesIn(c.id).map((s) => ({ label: s.name, href: servicePath(s.slug), blurb: s.blurb, pricing: s.pricing.mode })),
}));

/** All distinct hrefs the menu can emit — used by tests to prove no menu link points at a missing route. */
export const NAV_HREFS = Array.from(new Set(NAV_MEGA.flatMap((m) => m.items.map((i) => i.href))));

export const isKnownNavHref = (href: string) =>
  (LEGACY_PATHS as readonly string[]).includes(href) ||
  SERVICE_CATEGORIES.some((c) => href === `/services/${c.slug}`) ||
  CATALOG_SERVICES.some((s) => href === servicePath(s.slug));
