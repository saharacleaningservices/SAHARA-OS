// Email provider abstraction — currently used only for owner account-
// recovery notifications (Forgot Password / Forgot Login ID). No email
// provider is configured in this production deployment; this file exists so
// the recovery flow behaves identically to WhatsApp/SMS today (mirrors
// src/lib/sms.ts): every send writes an EmailMessage row first, so nothing
// is ever silently lost. If EMAIL_* env vars are set the row is delivered
// and marked SENT/FAILED; otherwise it stays QUEUED forever until
// `flushEmailQueue()` is run after credentials are added — no code change
// needed, and delivery is never fabricated as successful.
//
// The send itself is a generic HTTPS POST so any transactional-email
// provider with an HTTP API (Resend, SendGrid, Postmark, Mailgun, ...)
// works by setting the endpoint + api key + from address. The default
// payload shape suits Resend's API; override EMAIL_ENDPOINT/adjust the body
// below if a different provider's request shape is needed.
//
// Required env vars for real delivery (none of these exist in this
// deployment today):
//   EMAIL_API_KEY   — provider API key / bearer token
//   EMAIL_ENDPOINT  — provider's send-email HTTP endpoint
//   EMAIL_FROM      — verified "from" address for that provider

import { db } from "@/lib/db";

type EmailKind = "PASSWORD_OTP" | "LOGIN_ID_RECOVERY" | "OTHER";

export async function isEmailReady(): Promise<boolean> {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_ENDPOINT && process.env.EMAIL_FROM);
}

async function deliver(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.EMAIL_API_KEY;
  const endpoint = process.env.EMAIL_ENDPOINT;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !endpoint || !from) return { ok: false, error: "Email provider not configured" };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}

export async function sendEmail(input: {
  kind: EmailKind;
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  relatedType?: string;
  relatedId?: string;
}) {
  const row = await db.emailMessage.create({
    data: {
      toEmail: input.toEmail,
      toName: input.toName ?? null,
      subject: input.subject,
      body: input.body,
      kind: input.kind,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: "QUEUED",
    },
  });

  if (!(await isEmailReady())) return { queued: true, sent: false, id: row.id };

  const r = await deliver(input.toEmail, input.subject, input.body);
  await db.emailMessage.update({
    where: { id: row.id },
    data: {
      status: r.ok ? "SENT" : "FAILED",
      sentAt: r.ok ? new Date() : null,
      attempts: { increment: 1 },
      error: r.error ?? null,
    },
  });
  return { queued: false, sent: r.ok, id: row.id, error: r.error };
}

/** Retry every QUEUED / FAILED email — run after credentials are saved or by cron. */
export async function flushEmailQueue({ includeFailed = true }: { includeFailed?: boolean } = {}) {
  if (!(await isEmailReady())) return { flushed: 0, sent: 0 };
  const rows = await db.emailMessage.findMany({
    where: { status: { in: includeFailed ? ["QUEUED", "FAILED"] : ["QUEUED"] }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const m of rows) {
    const r = await deliver(m.toEmail, m.subject, m.body);
    await db.emailMessage.update({
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
