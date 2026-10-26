// SMS gateway abstraction — the fallback channel for staff attendance
// notifications and customer review requests when WhatsApp isn't reachable.
//
// Mirrors src/lib/whatsapp.ts: every send writes an SmsMessage row first, so
// nothing is ever silently lost. If a gateway is configured (Settings →
// Integrations, or the SMS_* env vars) the row is delivered and marked
// SENT/FAILED; otherwise it stays QUEUED and `flushSmsQueue()` drains it the
// moment credentials are saved — no code change needed.
//
// The send itself is a generic HTTPS POST so any provider (MSG91, Fast2SMS,
// Twilio, Kaleyra, …) works by setting the endpoint + api key + sender id.
// The default payload shape suits MSG91/Fast2SMS-style "flow" APIs; override
// `smsEndpoint` for a provider that needs a different URL.

import { db } from "@/lib/db";
import { getResolvedIntegrations } from "@/server/integrations";

type SmsKind = "ATTENDANCE" | "REVIEW" | "REMINDER" | "OTHER";

function normalize(n: string): string {
  const d = n.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

export async function isSmsReady(): Promise<boolean> {
  const { sms } = await getResolvedIntegrations();
  return Boolean(sms?.apiKey && sms?.endpoint);
}

async function deliver(to: string, body: string, dltTemplateId?: string | null): Promise<{ ok: boolean; error?: string }> {
  const { sms } = await getResolvedIntegrations();
  if (!sms?.apiKey || !sms?.endpoint) return { ok: false, error: "SMS gateway not configured" };
  try {
    const res = await fetch(sms.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: sms.apiKey, Authorization: `Bearer ${sms.apiKey}` },
      body: JSON.stringify({
        sender: sms.senderId ?? "SAHARA",
        route: "4",
        mobiles: to,
        recipients: [{ mobiles: to }],
        message: body,
        sms: [{ message: body, to: [to] }],
        // India DLT: the registered content-template id (MSG91 reads DLT_TE_ID, Fast2SMS template_id) and principal entity id.
        ...(dltTemplateId ? { DLT_TE_ID: dltTemplateId, template_id: dltTemplateId } : {}),
        ...(process.env.DLT_ENTITY_ID ? { PE_ID: process.env.DLT_ENTITY_ID, entity_id: process.env.DLT_ENTITY_ID } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}

export async function sendSMS(input: {
  kind: SmsKind;
  toNumber: string;
  toName?: string | null;
  body: string;
  relatedType?: string;
  relatedId?: string;
  /** OTPs: the log row keeps a redacted body and is never re-sent by flushSmsQueue (a stale code is useless). */
  sensitive?: boolean;
  /** DLT content-template id registered for this exact text (Indian operators drop unregistered promotional/transactional SMS). */
  dltTemplateId?: string | null;
}) {
  const to = normalize(input.toNumber);
  const row = await db.smsMessage.create({
    data: {
      toNumber: to,
      toName: input.toName ?? null,
      body: input.sensitive ? "[one-time code — not stored]" : input.body,
      kind: input.kind,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: "QUEUED",
    },
  });

  if (!(await isSmsReady())) {
    if (input.sensitive) await db.smsMessage.update({ where: { id: row.id }, data: { status: "FAILED", attempts: 5, error: "SMS gateway not configured" } });
    return { queued: !input.sensitive, sent: false, id: row.id };
  }

  const r = await deliver(to, input.body, input.dltTemplateId);
  await db.smsMessage.update({
    where: { id: row.id },
    data: {
      status: r.ok ? "SENT" : "FAILED",
      sentAt: r.ok ? new Date() : null,
      attempts: input.sensitive ? 5 : { increment: 1 },
      error: r.error ?? null,
    },
  });
  return { queued: false, sent: r.ok, id: row.id, error: r.error };
}

/** Retry every QUEUED / FAILED SMS — run after creds are saved or by cron. */
export async function flushSmsQueue({ includeFailed = true }: { includeFailed?: boolean } = {}) {
  if (!(await isSmsReady())) return { flushed: 0, sent: 0 };
  const rows = await db.smsMessage.findMany({
    where: { status: { in: includeFailed ? ["QUEUED", "FAILED"] : ["QUEUED"] }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const m of rows) {
    const r = await deliver(m.toNumber, m.body);
    await db.smsMessage.update({
      where: { id: m.id },
      data: {
        status: r.ok ? "SENT" : "FAILED",
        sentAt: r.ok ? new Date() : null,
        attempts: { increment: 1 },
        error: r.error ?? null,
      },
    });
    if (r.ok) sent += 1;
  }
  return { flushed: rows.length, sent };
}
