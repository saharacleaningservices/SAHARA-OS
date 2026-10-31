"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cancelPendingWhatsApp, previewPendingWhatsApp } from "@/lib/whatsapp";
import { requireAdminResult } from "@/lib/require-admin";


const requireAdmin = () => requireAdminResult("Admin only");

/** Counts of pending WhatsApp messages by category. Read-only. */
export async function previewStaleWhatsApp() {
  const { error } = await requireAdmin();
  if (error) return { error };
  return { success: true as const, ...(await previewPendingWhatsApp([])) };
}

/** Cancels every pending WhatsApp message. Sends nothing, deletes nothing. */
export async function cancelStaleWhatsApp() {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: error ?? "Admin only" };

  const before = await previewPendingWhatsApp([]);
  const count = await cancelPendingWhatsApp(
    [],
    `Cancelled by ${session.name} before WhatsApp Cloud API go-live (stale queue)`,
  );
  await db.auditLog.create({
    data: {
      entityType: "WhatsAppMessage",
      entityId: "stale-queue",
      action: "WHATSAPP_QUEUE_CANCELLED",
      summary: `Cancelled ${count} stale WhatsApp messages (${Object.entries(before.counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")})`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/whatsapp-log");
  revalidatePath("/settings");
  return { success: true as const, count };
}
