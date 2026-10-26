"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { COMPANY_DOC_CATEGORIES } from "@/lib/company-documents";

export async function getCompanyDocuments() {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return [] as never;
  }
  return db.companyDocument.findMany({ orderBy: { createdAt: "desc" } });
}

export async function addCompanyDocument(input: { category: string; label: string; url: string; sizeBytes?: number }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Admin only", success: false as const };
  if (!input.url?.startsWith("/uploads/") || !input.label?.trim()) {
    return { error: "Invalid document", success: false as const };
  }
  const category = (COMPANY_DOC_CATEGORIES as readonly string[]).includes(input.category)
    ? input.category
    : "OTHER";
  await db.companyDocument.create({
    data: {
      category,
      label: input.label.trim().slice(0, 80),
      url: input.url,
      sizeBytes: input.sizeBytes ?? null,
      uploadedByName: session.name,
    },
  });
  revalidatePath("/settings");
  return { success: true as const };
}

export async function deleteCompanyDocument(id: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Admin only", success: false as const };
  await db.companyDocument.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: true as const };
}
