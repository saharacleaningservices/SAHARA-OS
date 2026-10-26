"use server";

// Staff App self-service actions. The staff member is ALWAYS taken from the
// session — never from a form value — and preview sessions never write.

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { LANG_COOKIE, isLang } from "@/lib/staff-i18n";

/** Mark announcements read for the signed-in staff login. */
export async function markAnnouncementsRead(ids: string[]) {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !Array.isArray(ids)) return { ok: false };
  const clean = [...new Set(ids.filter((i) => typeof i === "string" && i.length < 64))].slice(0, 100);
  for (const announcementId of clean) {
    await db.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId: session.sub } },
      create: { announcementId, userId: session.sub },
      update: {},
    });
  }
  return { ok: true };
}

/** Language for the Staff App: kept on this phone (cookie) and on the staff record (all phones). */
export async function setMyLanguage(lang: string) {
  if (!isLang(lang)) return { ok: false };
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession();
  if (session?.role === "STAFF") await db.staff.updateMany({ where: { userId: session.sub, deletedAt: null }, data: { language: lang } });
  return { ok: true };
}

/**
 * Newest real notification for the signed-in staff login — used by the open
 * Staff App to show an in-app popup when push is unavailable. Only rows that
 * exist in the Notification table are ever shown (no fake alerts).
 */
export async function getMyLatestAlert() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") return null;
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId: session.sub, readAt: null } }),
    db.notification.findFirst({ where: { userId: session.sub, readAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, body: true, href: true, critical: true } }),
  ]);
  return { unread, latest };
}
