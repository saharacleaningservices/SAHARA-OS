"use server";

// Announcements — published from the CRM (/admin/announcements), shown in the
// Staff App. Only IMPORTANT announcements push a notification (one per staff
// login); normal ones just appear in the app. Archiving is always silent.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { notifyAllStaffUsers } from "@/server/staff-notify";

function canPublish(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS";
}

const schema = z.object({
  title: z.string().trim().min(3, "Add a short title").max(120),
  body: z.string().trim().min(3, "Write the announcement").max(2000),
  important: z.boolean().optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function listAnnouncementsForAdmin() {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return [];
  return db.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 100 });
}

export async function publishAnnouncement(values: unknown) {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return { error: "Not authorized" };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { title, body, important, expiresOn } = parsed.data;

  let expiresAt: Date | null = null;
  if (expiresOn) {
    const [y, m, d] = expiresOn.split("-").map(Number);
    expiresAt = new Date(y, m - 1, d, 23, 59, 59);
  }

  const row = await db.announcement.create({
    data: { title, body, important: Boolean(important), expiresAt, createdByName: session.name },
  });
  const sentTo = important
    ? await notifyAllStaffUsers({
        kind: "ANNOUNCEMENT",
        title: `Important: ${title}`,
        body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
        href: `/my/announcements#a-${row.id}`,
        recordId: row.id,
        important: true,
      })
    : 0;
  revalidatePath("/admin/announcements");
  revalidatePath("/my", "layout");
  return { success: true as const, sentTo };
}

export async function setAnnouncementActive(id: string, isActive: boolean) {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return { error: "Not authorized" };
  await db.announcement.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/announcements");
  revalidatePath("/my", "layout");
  return { success: true as const };
}
