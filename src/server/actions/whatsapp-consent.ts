"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { setWhatsAppOptIn } from "@/lib/whatsapp";
import { db } from "@/lib/db";

/**
 * Manually reinstates a WhatsApp number that opted out (customer asked by
 * phone/email to resubscribe, or an office user corrects a mistaken STOP
 * reply). Admin-only, same gate as the rest of the WhatsApp consent surface.
 */
export async function reinstateWhatsAppNumber(phoneNumber: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Admin only" };
  }
  if (!phoneNumber) {
    return { error: "No phone number provided" };
  }

  await setWhatsAppOptIn(phoneNumber);
  await db.auditLog.create({
    data: {
      entityType: "WhatsAppConsent",
      entityId: phoneNumber,
      action: "WHATSAPP_OPT_IN",
      summary: `Manually reinstated WhatsApp consent for ${phoneNumber}`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/whatsapp-log");
  return { success: true as const };
}
