// WhatsApp Cloud API (Meta) send abstraction.
//
// Every outbound WhatsApp message in the app — booking confirmations, team
// dispatch, customer/payment reminders, review requests, AMC renewals,
// attendance summaries — goes through `sendWhatsApp()` below. It always
// writes a `WhatsAppMessage` row first so nothing is ever silently lost:
//
//   - If WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID are configured,
//     it calls the real Meta Graph API and marks the row SENT/FAILED.
//   - If they are NOT configured (the default until Meta credentials are
//     issued), the row is left QUEUED and nothing is sent. No code change
//     is needed later — sends resume automatically the moment the two env
//     vars are set on Render.
//
// Important real-world constraint: the official WhatsApp Cloud API has no
// concept of "posting into an existing WhatsApp group" — that capability
// simply isn't exposed to businesses via the API (only 1:1 business-
// initiated or session messages). "Team schedule to Workers Group" is
// therefore implemented as an individual Cloud API message sent to every
// assigned staff member's own WhatsApp number — same information, same
// moment, just not literally inside a phone-native group thread.
//
// Outside a customer's 24-hour service window, Cloud API also requires a
// pre-approved message template rather than free-form text. Until your
// Meta Business Manager templates are approved, set WHATSAPP_USE_TEMPLATES
// unset (default) to send free-form text — this works today for any number
// that has messaged your business number in the last 24h (e.g. after a
// /book submission or an inbound chat), and will simply fail (logged as
// FAILED with Meta's error message, never thrown) for numbers outside that
// window until templates are wired up.

import { db } from "@/lib/db";

export type WhatsAppKind =
  | "BOOKING_CONFIRMATION"
  | "TEAM_DISPATCH"
  | "CUSTOMER_REMINDER"
  | "PAYMENT_REMINDER"
  | "REVIEW_REQUEST"
  | "AMC_RENEWAL"
  | "ATTENDANCE_SUMMARY"
  | "OTHER";

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function normalizeNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Queues (and, if configured, sends) one WhatsApp message. Never throws —
 * failures are recorded on the WhatsAppMessage row so a broken number or
 * expired token never breaks the calling action (booking confirm, job
 * completion, a reminder sweep, etc).
 */
export async function sendWhatsApp(input: {
  kind: WhatsAppKind;
  toNumber: string;
  toName?: string | null;
  body: string;
  relatedType?: string;
  relatedId?: string;
}) {
  const toNumber = normalizeNumber(input.toNumber);

  const message = await db.whatsAppMessage.create({
    data: {
      kind: input.kind,
      toNumber,
      toName: input.toName ?? null,
      body: input.body,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: "QUEUED",
    },
  });

  if (!isWhatsAppConfigured()) {
    return { queued: true as const, sent: false as const, id: message.id };
  }

  try {
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body: input.body, preview_url: false },
      }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage = payload?.error?.message || `HTTP ${res.status}`;
      await db.whatsAppMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", errorMessage },
      });
      return { queued: false as const, sent: false as const, id: message.id, error: errorMessage };
    }

    const providerMessageId: string | undefined = payload?.messages?.[0]?.id;
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "SENT", providerMessageId, sentAt: new Date() },
    });
    return { queued: false as const, sent: true as const, id: message.id };
  } catch (err) {
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage: (err as Error).message },
    });
    return { queued: false as const, sent: false as const, id: message.id, error: (err as Error).message };
  }
}

export async function sendWhatsAppMany(inputs: Parameters<typeof sendWhatsApp>[0][]) {
  const results = [];
  for (const input of inputs) {
    results.push(await sendWhatsApp(input));
  }
  return results;
}
