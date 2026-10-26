import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWhatsAppTemplate, normalizeNumber } from "@/lib/whatsapp";
import { sendSMS } from "@/lib/sms";
import { recordCallLead } from "@/server/call-lead";
import { callWebhookAuthorised } from "@/lib/call-webhook-auth";
import { AUTO_REPLY_COOLDOWN_HOURS, CALL_TEMPLATE_LANGUAGE, callDetailsFrom, callMetaFrom, callerFrom, classifyCall, planAutoReply, smsMode } from "@/lib/call-autoresponder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/webhooks/call-trigger — dual-channel call auto-responder (owner 2026-10-26).
 *
 * Point the IVR / telephony provider's "call ended" (or "missed call") webhook here. For each call:
 *   1. CRM: missed call → open lead matched or auto-created (15-min call-back follow-up); answered → note on the lead.
 *   2. WhatsApp (Meta Cloud API, +91 91752 20270): approved UTILITY template festival_booking_full_notice (while
 *      FESTIVAL_FULL_UNTIL is today or later) or missed_call_auto_responder (missed calls).
 *   3. SMS (DLT): same message by SMS — together with WhatsApp (CALL_TRIGGER_SMS=always, default), only when the
 *      WhatsApp send fails (=fallback), or never (=off).
 * One auto-reply per caller per 12 h. Owner / internal numbers never get one.
 *
 * Env:
 *   CALL_TRIGGER_TOKEN        shared secret (falls back to MISSED_CALL_TOKEN, then CRON_TOKEN). Send as
 *                             "Authorization: Bearer <token>" or ?token=<token>. Fails closed when unset.
 *   CALL_AUTOREPLY            "on" to actually send. Anything else = dry run: lead logging still happens and the
 *                             response shows exactly what would have been sent (safe to wire the provider first).
 *   FESTIVAL_FULL_UNTIL       YYYY-MM-DD (IST). Festival notice runs up to and including this date, then switches off.
 *   CALL_TRIGGER_SMS          always | fallback | off
 *   DLT_TEMPLATE_FESTIVAL_FULL / DLT_TEMPLATE_MISSED_CALL / DLT_ENTITY_ID   DLT registration ids for the SMS texts.
 */

async function readPayload(req: NextRequest): Promise<Record<string, unknown>> {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (req.method === "GET") return query;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      // Some providers wrap the call in { data: {...} } or { call: {...} }.
      const inner = j && typeof j === "object" ? ((j as Record<string, unknown>).data ?? (j as Record<string, unknown>).call ?? j) : {};
      return { ...query, ...(typeof inner === "object" && inner ? (inner as Record<string, unknown>) : {}) };
    }
    const fd = await req.formData();
    return { ...query, ...Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])) };
  } catch {
    return query;
  }
}

async function recentlyAnswered(mobile10: string): Promise<boolean> {
  const since = new Date(Date.now() - AUTO_REPLY_COOLDOWN_HOURS * 3600_000);
  const to = normalizeNumber(mobile10);
  const [wa, sms] = await Promise.all([
    db.whatsAppMessage.count({ where: { toNumber: to, relatedType: "CallTrigger", createdAt: { gte: since }, status: { not: "CANCELLED" } } }).catch(() => 0),
    db.smsMessage.count({ where: { toNumber: { endsWith: mobile10 }, relatedType: "CallTrigger", createdAt: { gte: since } } }).catch(() => 0),
  ]);
  return wa + sms > 0;
}

async function handle(req: NextRequest) {
  if (!callWebhookAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await readPayload(req);
  const caller = callerFrom(payload);
  if (!caller) return NextResponse.json({ error: "No valid Indian mobile caller number" }, { status: 400 });
  const event = classifyCall(payload);

  // History (the Helper app scanning old call logs, or a call that reaches us late) and outgoing calls are logged on an existing lead only:
  // no new lead, no call-back task and — below — no auto-reply.
  const meta = callMetaFrom(payload);
  const quiet = meta.backfill || meta.direction === "OUTGOING";
  const lead = await recordCallLead(caller, event, { ...callDetailsFrom(payload), externalId: meta.externalId, deviceLabel: meta.deviceLabel }, { noCreate: quiet }).catch((e) => {
    console.error("[call-trigger] lead logging failed", e);
    return { leadId: null, leadNumber: null, name: null, created: false };
  });

  const plan = quiet ? null : planAutoReply({ event, caller, now: new Date(), festivalFullUntil: process.env.FESTIVAL_FULL_UNTIL, name: lead.name });
  const base = { ok: true, event, lead: lead.leadNumber, leadCreated: lead.created, ...(quiet ? { logged: meta.backfill ? "backfill" : "outgoing" } : {}) };
  if (!plan) return NextResponse.json({ ...base, autoReply: "none" });

  if (process.env.CALL_AUTOREPLY !== "on") return NextResponse.json({ ...base, autoReply: "dry-run", template: plan.template, whatsapp: plan.preview, sms: plan.sms });
  if (await recentlyAnswered(caller)) return NextResponse.json({ ...base, autoReply: "skipped-cooldown", template: plan.template });

  const mode = smsMode(process.env.CALL_TRIGGER_SMS);
  const related = { relatedType: "CallTrigger", relatedId: lead.leadId ?? caller };
  const sendSms = () =>
    sendSMS({ kind: "OTHER", toNumber: caller, toName: lead.name, body: plan.sms, dltTemplateId: process.env[plan.smsTemplateEnv] || null, ...related }).catch((e) => ({ sent: false, error: String(e) }));
  const sendWa = () =>
    sendWhatsAppTemplate({ kind: "OTHER", toNumber: caller, toName: lead.name, templateName: plan.template, languageCode: CALL_TEMPLATE_LANGUAGE, bodyParams: plan.bodyParams, preview: plan.preview, ...related }).catch((e) => ({ sent: false, error: String(e) }));

  // "Simultaneous": both channels fire in parallel.
  const [wa, sms] = mode === "always" ? await Promise.all([sendWa(), sendSms()]) : [await sendWa(), null];
  let smsResult = sms;
  if (mode === "fallback" && !(wa as { sent?: boolean }).sent) smsResult = await sendSms();

  return NextResponse.json({
    ...base,
    autoReply: "attempted",
    template: plan.template,
    whatsapp: { sent: !!(wa as { sent?: boolean }).sent, error: (wa as { error?: string }).error ?? null },
    sms: smsResult ? { sent: !!(smsResult as { sent?: boolean }).sent, queued: !!(smsResult as { queued?: boolean }).queued, error: (smsResult as { error?: string }).error ?? null } : { sent: false, skipped: mode },
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
