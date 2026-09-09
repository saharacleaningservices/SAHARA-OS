// WhatsApp Cloud API (Meta) send abstraction.
//
// Every outbound WhatsApp message in the app — booking confirmations, team
// dispatch, customer/payment reminders, review requests, AMC renewals,
// attendance summaries — goes through `sendWhatsApp()` below. It always
// writes a `WhatsAppMessage` row first so nothing is ever silently lost:
//
//   - If the WhatsApp Cloud API is configured (credentials pasted in
//     /settings → Integrations, or the WHATSAPP_* env vars), it calls the
//     real Meta Graph API and marks the row SENT/FAILED.
//   - If it is NOT configured, the row is left QUEUED and nothing is sent.
//     No code change is needed later — the moment credentials are saved,
//     `flushWhatsAppQueue()` runs automatically (see
//     src/server/actions/integrations.ts) and every queued message goes out.
//
// Credentials are resolved through src/server/integrations.ts, which reads
// the IntegrationSettings row first and falls back to env vars.
//
// Real-world constraint: the official WhatsApp Cloud API has no concept of
// "posting into an existing WhatsApp group" — that capability isn't exposed
// to businesses via the API. "Team schedule to Workers Group" is therefore
// an individual Cloud API message sent to every assigned staff member's own
// number — same information, same moment.
//
// Outside a customer's 24-hour service window Cloud API also requires a
// pre-approved template rather than free-form text; until your Meta
// templates are approved, free-form works for any number that messaged your
// business number in the last 24h and is otherwise logged as FAILED with
// Meta's error message (never thrown).

import { db } from "@/lib/db";
import { getResolvedIntegrations } from "@/server/integrations";

export type WhatsAppKind =
  | "BOOKING_CONFIRMATION"
  | "TEAM_DISPATCH"
  | "CUSTOMER_REMINDER"
  | "PAYMENT_REMINDER"
  | "REVIEW_REQUEST"
  | "REVIEW_CAMPAIGN"
  | "AMC_RENEWAL"
  | "ATTENDANCE_SUMMARY"
  | "DEVICE_APPROVAL"
  | "OTHER";

/**
 * Env-only quick check. Kept for callers that can't be async; prefer
 * `isWhatsAppReady()` (which also sees credentials saved in Settings).
 */
export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** True if the Cloud API can send right now (Settings row OR env vars). */
export async function isWhatsAppReady(): Promise<boolean> {
  const { whatsapp } = await getResolvedIntegrations();
  return whatsapp.configured;
}

function normalizeNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

type SendConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
};

async function deliver(toNumber: string, body: string, cfg: SendConfig) {
  const res = await fetch(
    `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body, preview_url: false },
      }),
    }
  );
  const payload = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const err =
      (payload as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
    return { ok: false as const, error: err };
  }
  const providerMessageId = (payload as { messages?: { id?: string }[] })?.messages?.[0]?.id;
  return { ok: true as const, providerMessageId };
}

/**
 * Queues (and, if configured, sends) one WhatsApp message. Never throws —
 * failures are recorded on the WhatsAppMessage row so a broken number or
 * expired token never breaks the calling action.
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

  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.configured || !whatsapp.accessToken || !whatsapp.phoneNumberId) {
    return { queued: true as const, sent: false as const, id: message.id };
  }

  try {
    const result = await deliver(toNumber, input.body, {
      accessToken: whatsapp.accessToken,
      phoneNumberId: whatsapp.phoneNumberId,
      apiVersion: whatsapp.apiVersion,
    });
    if (!result.ok) {
      await db.whatsAppMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", errorMessage: result.error },
      });
      return { queued: false as const, sent: false as const, id: message.id, error: result.error };
    }
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "SENT", providerMessageId: result.providerMessageId, sentAt: new Date() },
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

/**
 * Sends every message still sitting in the queue. Called automatically right
 * after WhatsApp credentials are saved in Settings, and available as a
 * manual "Flush queue" button. Optionally also retries recently FAILED
 * messages (e.g. after fixing an expired token).
 */
export async function flushWhatsAppQueue(opts: { includeFailed?: boolean; limit?: number } = {}) {
  const { includeFailed = false, limit = 300 } = opts;
  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.configured || !whatsapp.accessToken || !whatsapp.phoneNumberId) {
    return { ok: false as const, reason: "WhatsApp is not configured", sent: 0, failed: 0 };
  }

  const cfg: SendConfig = {
    accessToken: whatsapp.accessToken,
    phoneNumberId: whatsapp.phoneNumberId,
    apiVersion: whatsapp.apiVersion,
  };

  const pending = await db.whatsAppMessage.findMany({
    where: { status: includeFailed ? { in: ["QUEUED", "FAILED"] } : "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const m of pending) {
    try {
      const result = await deliver(m.toNumber, m.body, cfg);
      if (result.ok) {
        await db.whatsAppMessage.update({
          where: { id: m.id },
          data: { status: "SENT", providerMessageId: result.providerMessageId, sentAt: new Date(), errorMessage: null },
        });
        sent += 1;
      } else {
        await db.whatsAppMessage.update({
          where: { id: m.id },
          data: { status: "FAILED", errorMessage: result.error },
        });
        failed += 1;
      }
    } catch (err) {
      await db.whatsAppMessage.update({
        where: { id: m.id },
        data: { status: "FAILED", errorMessage: (err as Error).message },
      });
      failed += 1;
    }
  }

  return { ok: true as const, sent, failed, processed: pending.length };
}
