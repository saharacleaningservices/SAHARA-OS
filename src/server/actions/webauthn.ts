"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** The signed-in user's own biometric devices (never anyone else's). */
export async function listMyPasskeys() {
  const session = await getSession();
  if (!session) return [];
  const rows = await db.webAuthnCredential.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
  return rows.map((r) => ({ id: r.id, label: r.label ?? "Device", createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
}

/** Turn biometric sign-in off for one of the user's own devices. */
export async function removeMyPasskey(id: string) {
  const session = await getSession();
  if (!session) return { error: "Signed out." };
  const row = await db.webAuthnCredential.findFirst({ where: { id, userId: session.sub }, select: { id: true, label: true } });
  if (!row) return { error: "Not found." };
  await db.webAuthnCredential.delete({ where: { id: row.id } });
  await db.auditLog
    .create({
      data: {
        entityType: "User",
        entityId: session.sub,
        action: "BIOMETRIC_REMOVED",
        summary: `${session.name} turned off biometric sign-in on ${row.label ?? "a device"}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  revalidatePath("/profile");
  revalidatePath("/my/account");
  return { ok: true };
}
