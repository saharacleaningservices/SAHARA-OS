"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-user";
import type { GalleryItemView } from "@/lib/gallery";

type AddInput = {
  type: string; // PHOTO | VIDEO
  kind: string; // BEFORE | AFTER | GENERAL
  category?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  pairKey?: string | null;
  featured?: boolean;
};

export async function addGalleryItem(input: AddInput) {
  const session = await requireRole(["ADMIN"]);
  if (!input.url) return { error: "Upload a file first" };
  const type = input.type === "VIDEO" ? "VIDEO" : "PHOTO";
  const kind = ["BEFORE", "AFTER", "GENERAL"].includes(input.kind) ? input.kind : "GENERAL";

  const last = await db.galleryItem.findFirst({ orderBy: { sortOrder: "desc" } }).catch(() => null);

  await db.galleryItem.create({
    data: {
      type,
      kind,
      category: input.category?.trim() || null,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      caption: input.caption?.trim() || null,
      pairKey: input.pairKey?.trim() || (kind === "GENERAL" ? null : randomUUID().slice(0, 12)),
      featured: input.featured ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdByName: session.name,
    },
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/book");
  return { success: true as const };
}

export async function deleteGalleryItem(id: string) {
  await requireRole(["ADMIN"]);
  await db.galleryItem.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/book");
  return { success: true as const };
}

export async function toggleGalleryFeatured(id: string, featured: boolean) {
  await requireRole(["ADMIN"]);
  await db.galleryItem.update({ where: { id }, data: { featured } }).catch(() => {});
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/book");
  return { success: true as const };
}

/** All gallery items for the admin manager (newest first). */
// Viewing matches the page (ROLE_NAV_ACCESS grants Gallery to Accounts and
// Operations); add / feature / delete stay ADMIN-only above.
export async function listGalleryItems(): Promise<GalleryItemView[]> {
  await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS"]);
  const rows = await db.galleryItem
    .findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
    .catch(() => []);
  return rows.map(toView);
}

function toView(r: {
  id: string;
  type: string;
  kind: string;
  category: string | null;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  pairKey: string | null;
  featured: boolean;
  sortOrder: number;
}): GalleryItemView {
  return {
    id: r.id,
    type: r.type,
    kind: r.kind,
    category: r.category,
    url: r.url,
    thumbnailUrl: r.thumbnailUrl,
    caption: r.caption,
    pairKey: r.pairKey,
    featured: r.featured,
    sortOrder: r.sortOrder,
  };
}

/**
 * Featured gallery items for the public booking page and the public /gallery
 * page. Never throws — an unmigrated DB or an empty gallery both return [].
 */
export async function getFeaturedGallery(limit = 24): Promise<GalleryItemView[]> {
  try {
    const rows = await db.galleryItem.findMany({
      where: { featured: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    return rows.map(toView);
  } catch {
    return [];
  }
}
