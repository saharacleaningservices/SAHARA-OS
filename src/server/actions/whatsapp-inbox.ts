"use server";

import { getSession } from "@/lib/session";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { findLeadForNumber, isWhatsAppReady, normalizeNumber, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { placeholderCount, renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { requireWhatsAppInboxUser, setConversationMode, type ConversationMode } from "@/server/whatsapp-access";

// Staff-initiated sends from the WhatsApp Inbox. Nothing here runs
// automatically: every send is one explicit click by an inbox user (Admin or
// Shoyab/Accounts), every send is attributed to that user, and a staff reply
// always takes the conversation over from the AI assistant (human takeover).

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const INBOX = "/admin/whatsapp-inbox";

/** True when the customer messaged us in the last 24h (free-form replies allowed). */
async function isServiceWindowOpen(number: string) {
  const last = await db.whatsAppMessage.findFirst({
    where: { toNumber: normalizeNumber(number), direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return Boolean(last && Date.now() - last.createdAt.getTime() < SERVICE_WINDOW_MS);
}

async function audit(action: string, summary: string, session: { name: string; email: string }, entityId = "whatsapp-inbox") {
  await db.auditLog.create({ data: { entityType: "WhatsAppMessage", entityId, action, summary, actorName: session.name, actorEmail: session.email } }).catch(() => {});
}

const replySchema = z.object({ number: z.string().min(10), text: z.string().trim().min(1).max(4000) });

export async function sendInboxReply(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await requireWhatsAppInboxUser();
  if (!session) return { error: "Not allowed" };
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { error: "Enter a message" };
  if (!(await isWhatsAppReady())) return { error: "WhatsApp Cloud API is not connected yet — nothing was sent." };
  if (!(await isServiceWindowOpen(parsed.data.number))) {
    return { error: "The customer hasn't messaged in the last 24 hours — send an approved template instead." };
  }

  const number = normalizeNumber(parsed.data.number);
  await setConversationMode(number, "HUMAN", session.name, "staff replied");
  const lead = await findLeadForNumber(number);
  const res = await sendWhatsApp({
    kind: "OTHER",
    toNumber: number,
    toName: lead?.name ?? null,
    body: parsed.data.text,
    relatedType: lead ? "Lead" : undefined,
    relatedId: lead?.id,
  });
  if ("id" in res && res.id) {
    await db.whatsAppMessage.update({ where: { id: res.id }, data: { sentByUserId: session.sub, sentByName: session.name } }).catch(() => {});
  }
  const ok = "sent" in res && res.sent;
  await audit("WHATSAPP_REPLY_SENT", `Reply to ${number}: ${ok ? "sent" : "not sent"}`, session, ("id" in res && res.id) || undefined);
  revalidatePath(INBOX);
  return ok ? { success: true as const } : { error: ("error" in res && res.error) || "Meta rejected the message" };
}

const templateSchema = z.object({
  number: z.string().min(10),
  templateName: z.string().min(1),
  params: z.array(z.string().trim().max(500)).max(10),
});

export async function sendInboxTemplate(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await requireWhatsAppInboxUser();
  if (!session) return { error: "Not allowed" };
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid template request" };
  const t = templateByName(parsed.data.templateName);
  if (!t) return { error: "Unknown template" };
  if ((t.buttons ?? []).some((b) => b.type === "URL" && b.url.endsWith("{{1}}"))) {
    return { error: "This template carries a customer-specific link and is sent automatically by the booking workflow, not from the inbox." };
  }
  const params = parsed.data.params.slice(0, placeholderCount(t));
  if (params.length !== placeholderCount(t) || params.some((p) => !p)) {
    return { error: `Fill all ${placeholderCount(t)} template fields` };
  }

  const number = normalizeNumber(parsed.data.number);
  const lead = await findLeadForNumber(number);
  if (t.category === "MARKETING" && t.name !== "sahara_test_booking") {
    const mobile = number.slice(-10);
    const optedOut = await db.lead.findFirst({ where: { OR: [{ mobile }, { whatsapp: mobile }], marketingConsent: "OPTED_OUT" }, select: { id: true } });
    const waOptOut = await db.whatsAppConsent.findUnique({ where: { phoneNumber: number }, select: { optedOut: true } });
    if (optedOut || waOptOut?.optedOut) return { error: "This customer opted out of promotional messages." };
  }
  await setConversationMode(number, "HUMAN", session.name, "staff sent template");
  const res = await sendWhatsAppTemplate({
    kind: "OTHER",
    toNumber: number,
    toName: lead?.name ?? null,
    templateName: t.name,
    languageCode: t.language,
    bodyParams: params,
    preview: renderTemplatePreview(t, params),
    relatedType: lead ? "Lead" : undefined,
    relatedId: lead?.id,
  });
  if ("id" in res && res.id) {
    await db.whatsAppMessage.update({ where: { id: res.id }, data: { sentByUserId: session.sub, sentByName: session.name } }).catch(() => {});
  }
  await audit("WHATSAPP_TEMPLATE_SENT", `Template ${t.name} to ${number}: ${res.sent ? "sent" : `not sent (${res.error})`}`, session, ("id" in res && res.id) || undefined);
  revalidatePath(INBOX);
  return res.sent ? { success: true as const } : { error: res.error ?? "Meta rejected the template" };
}

/** Human takeover / hand back to the AI assistant for one conversation. */
export async function setInboxConversationMode(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await requireWhatsAppInboxUser();
  if (!session) return { error: "Not allowed" };
  const parsed = z.object({ number: z.string().min(10), mode: z.enum(["AI", "HUMAN"]) }).safeParse(values);
  if (!parsed.success) return { error: "Invalid request" };
  const number = normalizeNumber(parsed.data.number);
  const mode = parsed.data.mode as ConversationMode;
  await setConversationMode(number, mode, session.name, mode === "HUMAN" ? "staff takeover" : "handed back to AI");
  await audit(mode === "HUMAN" ? "WHATSAPP_HUMAN_TAKEOVER" : "WHATSAPP_HANDED_TO_AI", `${number} → ${mode}`, session);
  revalidatePath(INBOX);
  return { success: true as const };
}
