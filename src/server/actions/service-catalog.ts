"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SERVICE_CATALOG_SEED } from "@/lib/service-catalog-seed";

const lines = z.string().max(20_000).transform((t) => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
const schema = z.object({ slug: z.string().min(1).max(80), scopeOfWork: lines, termsConditions: lines, equipmentsUsed: lines, reviewed: z.boolean() });

/**
 * Super Admin only: save the wording of one catalog entry (one item per line) and mark it reviewed. The first save copies the
 * defaults into the database; later edits change only what the owner typed. Quotations pick the saved wording up immediately.
 */
export async function saveCatalogEntry(values: unknown) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can edit the Service Catalog." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { success: false as const, error: "Invalid catalog entry." };
  const v = parsed.data;
  const seed = SERVICE_CATALOG_SEED.find((s) => s.slug === v.slug);
  const existing = await db.serviceCatalog.findUnique({ where: { slug: v.slug }, select: { name: true, serviceGroup: true } });
  if (!seed && !existing) return { success: false as const, error: "Unknown catalog entry." };
  if (v.scopeOfWork.length === 0) return { success: false as const, error: "Scope of work cannot be empty." };
  const data = {
    scopeOfWork: JSON.stringify(v.scopeOfWork),
    termsConditions: JSON.stringify(v.termsConditions),
    equipmentsUsed: JSON.stringify(v.equipmentsUsed),
    reviewed: v.reviewed,
    updatedByName: session.name,
  };
  await db.serviceCatalog.upsert({
    where: { slug: v.slug },
    update: data,
    create: { slug: v.slug, name: seed?.name ?? existing!.name, serviceGroup: seed?.group ?? existing!.serviceGroup, sortOrder: Math.max(0, SERVICE_CATALOG_SEED.findIndex((s) => s.slug === v.slug)), ...data },
  });
  revalidatePath("/service-catalog");
  return { success: true as const };
}
