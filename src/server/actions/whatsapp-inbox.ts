"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findLeadForNumber, isWhatsAppReady, normalizeNumber, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { placeholderCount, renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";

// Staff-initiated sends from the WhatsApp Inbox. Nothing here runs
// automatically: every send is one explicit click by an ADMIN/ACCOUNTS user,
// and nothing is queued if the Cloud API isn't connected.

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function requireInboxUser() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return null;
  return session;
}

/** True when the customer messaged us in the last 24h (free-form replies allowed). */
async function isServiceWindowOpen(number: string) {
  const last = await db.whatsAppMessage.findFirst({
    where: { toNumber: normalizeNumber(number), direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return Boolean(last && Date.now() - last.createdAt.getTime() < SERVICE_WINDOW_MS);
}

const replySchema = z.object({ number: z.string().min(10), text: z.string().trim().min(1).max(4000) });

export async function sendInboxReply(values: unknown) {
  const session = await requireInboxUser();
  if (!session) return { error: "Not allowed" };
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { error: "Enter a message" };
  if (!(await isWhatsAppReady())) return { error: "WhatsApp Cloud API is not connected yet — nothing was sent." };
  if (!(await isServiceWindowOpen(parsed.data.number))) {
    return { error: "The customer hasn't messaged in the last 24 hours — send an approved template instead." };
  }

  const lead = await findLeadForNumber(parsed.data.number);
  const res = await sendWhatsApp({
    kind: "OTHER",
    toNumber: parsed.data.number,
    toName: lead?.name ?? null,
    body: parsed.data.text,
    relatedType: lead ? "Lead" : undefined,
    relatedId: lead?.id,
  });
  revalidatePath("/admin/whatsapp-inbox");
  if ("sent" in res && res.sent) return { success: true as const };
  return { error: ("error" in res && res.error) || "Meta rejected the message" };
}

const templateSchema = z.object({
  number: z.string().min(10),
  templateName: z.string().min(1),
  params: z.array(z.string().trim().max(500)).max(10),
});

export async function sendInboxTemplate(values: unknown) {
  const session = await requireInboxUser();
  if (!session) return { error: "Not allowed" };
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid template request" };
  const t = templateByName(parsed.data.templateName);
  if (!t) return { error: "Unknown template" };
  const params = parsed.data.params.slice(0, placeholderCount(t));
  if (params.length !== placeholderCount(t) || params.some((p) => !p)) {
    return { error: `Fill all ${placeholderCount(t)} template fields` };
  }

  const lead = await findLeadForNumber(parsed.data.number);
  if (t.category === "MARKETING" && t.name !== "sahara_test_booking") {
    const mobile = normalizeNumber(parsed.data.number).slice(-10);
    const optedOut = await db.lead.findFirst({ where: { OR: [{ mobile }, { whatsapp: mobile }], marketingConsent: "OPTED_OUT" }, select: { id: true } });
    if (optedOut) return { error: "This customer opted out of promotional messages." };
  }
  const res = await sendWhatsAppTemplate({
    kind: "OTHER",
    toNumber: parsed.data.number,
    toName: lead?.name ?? null,
    templateName: t.name,
    languageCode: t.language,
    bodyParams: params,
    preview: renderTemplatePreview(t, params),
    relatedType: lead ? "Lead" : undefined,
    relatedId: lead?.id,
  });
  await db.auditLog
    .create({
      data: {
        entityType: "WhatsAppMessage",
        entityId: ("id" in res && res.id) || "not-created",
        action: "WHATSAPP_TEMPLATE_SENT",
        summary: `Template ${t.name} to ${normalizeNumber(parsed.data.number)}: ${res.sent ? "sent" : `not sent (${res.error})`}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  revalidatePath("/admin/whatsapp-inbox");
  return res.sent ? { success: true as const } : { error: res.error ?? "Meta rejected the template" };
}
