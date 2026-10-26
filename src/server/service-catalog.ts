// Service Catalog reads. Stored rows win; an entry nobody has saved yet falls back to the code defaults, so the catalog,
// the quotation and the crew card always have wording to show. No prices here. Not a "use server" module.
import { db } from "@/lib/db";
import { SERVICE_CATALOG_SEED, type CatalogGroup } from "@/lib/service-catalog-seed";

export type CatalogEntry = {
  slug: string;
  name: string;
  group: CatalogGroup;
  scopeOfWork: string[];
  termsConditions: string[];
  equipmentsUsed: string[];
  reviewed: boolean;
  stored: boolean;
  updatedByName: string | null;
};

const list = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

export async function getServiceCatalog(): Promise<CatalogEntry[]> {
  const rows = await db.serviceCatalog.findMany({ where: { isActive: true } }).catch(() => []);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const seeded = SERVICE_CATALOG_SEED.map((s): CatalogEntry => {
    const r = bySlug.get(s.slug);
    return r
      ? { slug: s.slug, name: r.name, group: r.serviceGroup as CatalogGroup, scopeOfWork: list(r.scopeOfWork), termsConditions: list(r.termsConditions), equipmentsUsed: list(r.equipmentsUsed), reviewed: r.reviewed, stored: true, updatedByName: r.updatedByName }
      : { ...s, reviewed: false, stored: false, updatedByName: null };
  });
  // Any extra entry the owner added directly in the database keeps showing too.
  const extra = rows.filter((r) => !SERVICE_CATALOG_SEED.some((s) => s.slug === r.slug)).map((r): CatalogEntry => ({ slug: r.slug, name: r.name, group: r.serviceGroup as CatalogGroup, scopeOfWork: list(r.scopeOfWork), termsConditions: list(r.termsConditions), equipmentsUsed: list(r.equipmentsUsed), reviewed: r.reviewed, stored: true, updatedByName: r.updatedByName }));
  return [...seeded, ...extra];
}

/**
 * Which catalog entry a booking uses, for the quotation's scope / equipment / terms. Matches on the package name first
 * (Premium / Platinum / unfurnished), then on the service type. Returns null when nothing fits (the document then keeps
 * its existing scope and compact terms).
 */
export function catalogSlugForJob(job: { service: string; packageName?: string | null; serviceVariant?: string | null }): string | null {
  const text = `${job.packageName ?? ""} ${job.serviceVariant ?? ""}`.toLowerCase();
  if (job.service === "PEST_CONTROL") return "pest-control";
  if (job.service === "INTERIOR_PAINTING") return "interior-painting";
  if (job.service === "COMMERCIAL_CLEANING" || job.service === "HOUSEKEEPING") return "office-cleaning";
  if (job.service === "HOME_DEEP_CLEANING") {
    if (/unfurnished/.test(text)) return "unfurnished-flat";
    if (/platinum/.test(text)) return "full-home-platinum";
    if (/premium/.test(text)) return "full-home-premium";
    if (/bathroom/.test(text)) return "bathroom-cleaning";
    if (/kitchen/.test(text)) return "kitchen-cleaning";
    if (/sofa|carpet|shampoo/.test(text)) return "sofa-carpet-shampooing";
  }
  return null;
}

export async function getCatalogEntryForJob(job: { service: string; packageName?: string | null; serviceVariant?: string | null }): Promise<CatalogEntry | null> {
  const slug = catalogSlugForJob(job);
  if (!slug) return null;
  return (await getServiceCatalog()).find((e) => e.slug === slug) ?? null;
}
