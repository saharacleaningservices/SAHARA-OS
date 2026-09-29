"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { cancelPendingWhatsApp, previewPendingWhatsApp } from "@/lib/whatsapp";
import { qaKeepIds } from "@/server/whatsapp-qa";


async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Admin only" as const, session: null };
  return { error: null, session };
}

/** Counts of pending WhatsApp messages by category. Read-only. */
export async function previewStaleWhatsApp() {
  const { error } = await requireAdmin();
  if (error) return { error };
  return { success: true as const, ...(await previewPendingWhatsApp(await qaKeepIds())) };
}

/** Cancels every pending WhatsApp message except the QA test. Sends nothing, deletes nothing. */
export async function cancelStaleWhatsApp() {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: error ?? "Admin only" };

  const keepIds = await qaKeepIds();
  const before = await previewPendingWhatsApp(keepIds);
  const count = await cancelPendingWhatsApp(
    keepIds,
    `Cancelled by ${session.name} before WhatsApp Cloud API go-live (stale queue)`,
  );
  await db.auditLog.create({
    data: {
      entityType: "WhatsAppMessage",
      entityId: "stale-queue",
      action: "WHATSAPP_QUEUE_CANCELLED",
      summary: `Cancelled ${count} stale WhatsApp messages (${Object.entries(before.counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")}; QA test kept)`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/whatsapp-log");
  revalidatePath("/settings");
  return { success: true as const, count };
}
