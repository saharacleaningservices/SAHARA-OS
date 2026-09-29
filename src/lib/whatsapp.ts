// WhatsApp Cloud API (Meta) send abstraction.
//
// Every outbound WhatsApp message in the app — booking confirmations, team
// dispatch, customer/payment reminders, review requests, AMC renewals,
// attendance summaries — goes through `sendWhatsApp()` below. It always
// writes a `WhatsAppMessage` row first so nothing is ever silently lost:
//
// - If the recipient has opted out (see WhatsAppConsent / isOptedOut()
//   below), the row is written as FAILED with a clear reason and nothing is
//   sent — Meta Cloud API policy requires honoring STOP-style replies.
// - If the WhatsApp Cloud API is configured (credentials pasted in
//   /settings → Integrations, or the WHATSAPP_* env vars), it calls the
//   real Meta Graph API and marks the row SENT/FAILED.
// - If it is NOT configured, the row is left QUEUED and nothing is sent.
//   No code change is needed later — the moment credentials are saved,
//   `flushWhatsAppQueue()` runs automatically (see
//   src/server/actions/integrations.ts) and every queued message goes out.
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
  | "DAILY_SUMMARY"
  | "MONTHLY_SUMMARY"
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

// Exported so the inbound webhook (and anything else matching a raw Meta
// "from" number against our records) normalizes the same way sendWhatsApp()
// does — a mismatch here would silently break opt-out matching.
export function normalizeNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

// ─────────────────────────────────────────────────────────────────────────
// Consent / opt-out tracking (Phase D). One row per phone number, checked
// before every send. Flipped automatically by the inbound webhook when a
// customer texts an opt-out/opt-in keyword (see
// src/app/api/webhooks/whatsapp/route.ts), and manageable by hand from the
// Message Log (src/app/(app)/admin/whatsapp-log).
// ─────────────────────────────────────────────────────────────────────────

export const WHATSAPP_OPT_OUT_ERROR = "Recipient opted out of WhatsApp messages";

/** True if this number has opted out — checked by sendWhatsApp() before every send. */
export async function isOptedOut(mobile: string): Promise<boolean> {
  const phoneNumber = normalizeNumber(mobile);
  const row = await db.whatsAppConsent.findUnique({ where: { phoneNumber } });
  return row?.optedOut === true;
}

/** Records an opt-out. `via` distinguishes an inbound STOP reply from a manual admin action. */
export async function setWhatsAppOptOut(mobile: string, via: "CUSTOMER_REPLY" | "MANUAL", notes?: string) {
  const phoneNumber = normalizeNumber(mobile);
  await db.whatsAppConsent.upsert({
    where: { phoneNumber },
    create: { phoneNumber, optedOut: true, optedOutAt: new Date(), optedOutVia: via, notes: notes ?? null },
    update: { optedOut: true, optedOutAt: new Date(), optedOutVia: via, notes: notes ?? null },
  });
}

/** Reverses an opt-out — an inbound START/SUBSCRIBE reply, or an admin reinstating by hand. */
export async function setWhatsAppOptIn(mobile: string) {
  const phoneNumber = normalizeNumber(mobile);
  await db.whatsAppConsent.upsert({
    where: { phoneNumber },
    create: { phoneNumber, optedOut: false, reinstatedAt: new Date() },
    update: { optedOut: false, reinstatedAt: new Date() },
  });
}

/** Every currently opted-out number, most recently opted-out first — for the Message Log admin view. */
export async function listOptedOutNumbers() {
  return db.whatsAppConsent.findMany({
    where: { optedOut: true },
    orderBy: { optedOutAt: "desc" },
  });
}

type SendConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
};

async function deliverPayload(toNumber: string, body: Record<string, unknown>, cfg: SendConfig) {
  const res = await fetch(
    `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toNumber, ...body }),
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

async function deliver(toNumber: string, body: string, cfg: SendConfig) {
  return deliverPayload(toNumber, { type: "text", text: { body, preview_url: false } }, cfg);
}

export type InteractiveListRow = { id: string; title: string; description?: string };

/**
 * Sends a Cloud API "interactive list" message — up to 10 tappable rows in
 * one message, the right primitive for the "More Options" fan-out (Phase 5
 * readiness, 2026-09-21: Reschedule / Pay After Service / Add to Calendar /
 * Google Review / Before-After Photos / Call Support / WhatsApp Support —
 * 7 options, well within Meta's cap, too many for a 3-button message).
 * Inert until WhatsApp Cloud API credentials are configured, exactly like
 * deliver() above.
 */
async function deliverInteractiveList(
  toNumber: string,
  input: { bodyText: string; buttonLabel: string; rows: InteractiveListRow[] },
  cfg: SendConfig,
) {
  return deliverPayload(
    toNumber,
    {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.bodyText },
        action: {
          button: input.buttonLabel,
          sections: [{ title: "Options", rows: input.rows.map((r) => ({ id: r.id, title: r.title, description: r.description })) }],
        },
      },
    },
    cfg,
  );
}

/**
 * Queues (and, if configured, sends) one WhatsApp message. Never throws —
 * failures are recorded on the WhatsAppMessage row so a broken number, an
 * opted-out recipient, or an expired token never breaks the calling action.
 */
export async function sendWhatsApp(input: {
  kind: WhatsAppKind;
  toNumber: string;
  toName?: string | null;
  body: string;
  relatedType?: string;
  relatedId?: string;
  // Only for the opt-out/opt-in confirmation reply the inbound webhook sends
  // immediately after flipping consent — every other caller must go through
  // the normal opt-out gate below.
  skipConsentCheck?: boolean;
}) {
  const toNumber = normalizeNumber(input.toNumber);
  const optedOut = input.skipConsentCheck ? false : await isOptedOut(toNumber);

  const message = await db.whatsAppMessage.create({
    data: {
      kind: input.kind,
      toNumber,
      toName: input.toName ?? null,
      body: input.body,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: optedOut ? "FAILED" : "QUEUED",
      errorMessage: optedOut ? WHATSAPP_OPT_OUT_ERROR : null,
    },
  });

  if (optedOut) {
    return { queued: false as const, sent: false as const, id: message.id, error: WHATSAPP_OPT_OUT_ERROR };
  }

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

/**
 * Queues (and, if configured, sends) one WhatsApp interactive list message
 * — the "More Options" fan-out from a booking confirmation (Reschedule /
 * Pay After Service / Add to Calendar / Google Review / Before-After
 * Photos / Call Support / WhatsApp Support). Mirrors sendWhatsApp()'s
 * queue/opt-out/log behavior exactly; the WhatsAppMessage row's `body`
 * stores a plain-text summary of the rows (for the Message Log), while the
 * real structured interactive payload is what's actually sent to Meta.
 */
export async function sendWhatsAppInteractiveList(input: {
  kind: WhatsAppKind;
  toNumber: string;
  toName?: string | null;
  bodyText: string;
  buttonLabel: string;
  rows: InteractiveListRow[];
  relatedType?: string;
  relatedId?: string;
}) {
  const toNumber = normalizeNumber(input.toNumber);
  const optedOut = await isOptedOut(toNumber);
  const summary = `${input.bodyText}\n${input.rows.map((r) => `• ${r.title}`).join("\n")}`;

  const message = await db.whatsAppMessage.create({
    data: {
      kind: input.kind,
      toNumber,
      toName: input.toName ?? null,
      body: summary,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: optedOut ? "FAILED" : "QUEUED",
      errorMessage: optedOut ? WHATSAPP_OPT_OUT_ERROR : null,
    },
  });

  if (optedOut) {
    return { queued: false as const, sent: false as const, id: message.id, error: WHATSAPP_OPT_OUT_ERROR };
  }

  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.configured || !whatsapp.accessToken || !whatsapp.phoneNumberId) {
    return { queued: true as const, sent: false as const, id: message.id };
  }

  try {
    const result = await deliverInteractiveList(
      toNumber,
      { bodyText: input.bodyText, buttonLabel: input.buttonLabel, rows: input.rows },
      { accessToken: whatsapp.accessToken, phoneNumberId: whatsapp.phoneNumberId, apiVersion: whatsapp.apiVersion },
    );
    if (!result.ok) {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "FAILED", errorMessage: result.error } });
      return { queued: false as const, sent: false as const, id: message.id, error: result.error };
    }
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "SENT", providerMessageId: result.providerMessageId, sentAt: new Date() },
    });
    return { queued: false as const, sent: true as const, id: message.id };
  } catch (err) {
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "FAILED", errorMessage: (err as Error).message } });
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
 * messages (e.g. after fixing an expired token). Messages to a number that
 * has since opted out are marked FAILED instead of being (re)sent.
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
  let skippedOptedOut = 0;
  for (const m of pending) {
    if (await isOptedOut(m.toNumber)) {
      await db.whatsAppMessage.update({
        where: { id: m.id },
        data: { status: "FAILED", errorMessage: WHATSAPP_OPT_OUT_ERROR },
      });
      skippedOptedOut += 1;
      continue;
    }
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

  return { ok: true as const, sent, failed, skippedOptedOut, processed: pending.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Stale-queue cancellation. Before the Cloud API is first connected, the
// backlog of never-sent messages (old confirmations, dispatches, OTPs…)
// must not be flushed. Cancelled rows keep their full record for audit;
// flushWhatsAppQueue() only ever selects QUEUED/FAILED, so a CANCELLED row
// can never be sent by Save & Connect, the reminder cron or a manual flush.
// ─────────────────────────────────────────────────────────────────────────

export type PendingCategory = "Customer" | "Staff/team" | "OTP/security" | "Other" | "QA test";

const CUSTOMER_KINDS = new Set<WhatsAppKind>([
  "BOOKING_CONFIRMATION", "CUSTOMER_REMINDER", "PAYMENT_REMINDER", "REVIEW_REQUEST", "REVIEW_CAMPAIGN", "AMC_RENEWAL",
]);
const STAFF_KINDS = new Set<WhatsAppKind>(["TEAM_DISPATCH", "ATTENDANCE_SUMMARY"]);

function categorize(m: { id: string; kind: WhatsAppKind; body: string }, keepIds: Set<string>): PendingCategory {
  if (keepIds.has(m.id)) return "QA test";
  if (m.kind === "DEVICE_APPROVAL" || /OTP|signed in|login/i.test(m.body)) return "OTP/security";
  if (CUSTOMER_KINDS.has(m.kind)) return "Customer";
  if (STAFF_KINDS.has(m.kind)) return "Staff/team";
  return "Other";
}

/** Counts every pending (QUEUED/FAILED) message by category. Sends nothing. */
export async function previewPendingWhatsApp(keepIds: string[]) {
  const keep = new Set(keepIds);
  const pending = await db.whatsAppMessage.findMany({
    where: { status: { in: ["QUEUED", "FAILED"] } },
    select: { id: true, kind: true, body: true },
  });
  const counts: Record<PendingCategory, number> = { Customer: 0, "Staff/team": 0, "OTP/security": 0, Other: 0, "QA test": 0 };
  for (const m of pending) counts[categorize(m, keep)] += 1;
  return { total: pending.length, counts };
}

/**
 * Marks every pending message CANCELLED except the explicitly kept message
 * ids (the QA test). Never deletes, never sends.
 */
export async function cancelPendingWhatsApp(keepIds: string[], reason: string) {
  const res = await db.whatsAppMessage.updateMany({
    where: { status: { in: ["QUEUED", "FAILED"] }, id: { notIn: keepIds } },
    data: { status: "CANCELLED", errorMessage: reason },
  });
  return res.count;
}
