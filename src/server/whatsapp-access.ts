import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import { normalizeNumber } from "@/lib/whatsapp";

// Who may read and reply in the WhatsApp Inbox: the owner (ADMIN) and Accounts
// (Shoyab) only — shared conversations, both can reply. Checked on every inbox
// page load and every send.

export async function canUseWhatsAppInbox(session: SessionPayload | null) {
  return Boolean(session && (session.role === "ADMIN" || session.role === "ACCOUNTS"));
}

export async function requireWhatsAppInboxUser() {
  const session = await getSession();
  return (await canUseWhatsAppInbox(session)) ? session : null;
}

export type ConversationMode = "AI" | "HUMAN";

/** Current handling mode for a customer number (defaults to HUMAN — staff first). */
export async function getConversationMode(number: string): Promise<ConversationMode> {
  const row = await db.whatsAppConversation.findUnique({ where: { number: normalizeNumber(number) }, select: { mode: true } });
  return row?.mode === "AI" ? "AI" : "HUMAN";
}

/** Switches who handles a conversation and records who/why for the audit trail. */
export async function setConversationMode(number: string, mode: ConversationMode, changedByName: string, reason?: string) {
  const n = normalizeNumber(number);
  await db.whatsAppConversation.upsert({
    where: { number: n },
    create: { number: n, mode, changedByName, changedAt: new Date(), handoffReason: reason ?? null },
    update: { mode, changedByName, changedAt: new Date(), handoffReason: reason ?? null },
  });
}
