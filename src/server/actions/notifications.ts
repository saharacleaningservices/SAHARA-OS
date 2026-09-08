"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVapidPublicKey } from "@/lib/webpush";

export async function getPushPublicKey() {
  return getVapidPublicKey();
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Invalid subscription" as const };
  }
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: session.sub,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: sub.userAgent?.slice(0, 200) ?? null,
    },
    update: { userId: session.sub, p256dh: sub.keys.p256dh, auth: sub.keys.auth, lastOkAt: new Date() },
  });
  return { success: true as const };
}

export async function deletePushSubscription(endpoint: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const };
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.sub } });
  return { success: true as const };
}

export async function markNotificationsRead(ids?: string[]) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const };
  await db.notification.updateMany({
    where: {
      userId: session.sub,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { success: true as const };
}
