// Dual-channel call auto-responder (owner 2026-10-26) — pure rules, no database, no network.
// Used by POST /api/v1/webhooks/call-trigger: a telephony provider (Exotel, MyOperator, Knowlarity, Servetel, Tata
// Smartflo …) posts a call-end / missed-call event; we answer the caller on WhatsApp (Meta Cloud API template from
// +91 91752 20270) and by DLT SMS.
//
// Template choice:
//   • festival window active (FESTIVAL_FULL_UNTIL=YYYY-MM-DD and today ≤ that date, IST) → festival_booking_full_notice
//     for missed AND answered calls (every caller hears "slots full until X, book from X+1").
//   • otherwise, missed call → missed_call_auto_responder; answered call → nothing (the team already spoke to them).

import { CALL_BOOKING_URL, TRUST } from "@/lib/booking-target";
import { last10, isProtectedNumber } from "@/lib/protected-numbers";
import { templateByName, renderTemplatePreview } from "@/lib/whatsapp-cloud-templates";

export type CallEvent = "MISSED" | "ANSWERED";
export type AutoReplyTemplate = "festival_booking_full_notice" | "missed_call_auto_responder";

export const CALL_TEMPLATE_LANGUAGE = "en";
/** One auto-reply per caller per this many hours (stops a caller who rings 5 times getting 5 messages). */
export const AUTO_REPLY_COOLDOWN_HOURS = 12;

const MISSED_WORDS = /^(missed|missed[_-]?call|no[_-]?answer|noanswer|not[_-]?answered|unanswered|busy|failed|cancel+ed|abandoned|voicemail|dropped)$/i;
const ANSWERED_WORDS = /^(answered|completed|complete|connected|call[_-]?end(ed)?|ended|hangup|hung[_-]?up|success)$/i;

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Caller number from the field names the common Indian IVR providers use. Returns the last 10 digits, or null. */
export function callerFrom(payload: Record<string, unknown>): string | null {
  const raw = pick(payload, ["caller", "caller_number", "callerNumber", "from", "From", "CallFrom", "callfrom", "customer_number", "customerNumber", "mobile", "number", "msisdn", "cli"]);
  const n = last10(raw);
  return n.length === 10 && /^[6-9]/.test(n) ? n : null;
}

/**
 * MISSED or ANSWERED from the provider's status / duration fields. A call with 0 talk-time (or a missed/busy/no-answer
 * status) is MISSED; any positive talk-time or an answered/completed status is ANSWERED. Unknown → MISSED (safer: the
 * caller still gets the booking link).
 */
export function classifyCall(payload: Record<string, unknown>): CallEvent {
  const status = pick(payload, ["event", "event_type", "eventType", "status", "Status", "call_status", "callStatus", "CallStatus", "DialCallStatus", "type"]);
  if (status) {
    const s = status.replace(/\s+/g, "_");
    if (MISSED_WORDS.test(s)) return "MISSED";
    if (ANSWERED_WORDS.test(s)) {
      const dur = Number(pick(payload, ["duration", "Duration", "talk_time", "talkTime", "billsec", "DialCallDuration", "conversation_duration"]) ?? "NaN");
      return Number.isFinite(dur) && dur <= 0 ? "MISSED" : "ANSWERED";
    }
  }
  const dur = Number(pick(payload, ["duration", "Duration", "talk_time", "talkTime", "billsec", "DialCallDuration", "conversation_duration"]) ?? "NaN");
  if (Number.isFinite(dur)) return dur > 0 ? "ANSWERED" : "MISSED";
  return "MISSED";
}

/**
 * Call details the CRM keeps on the lead timeline (owner 2026-10-26): talk time in seconds and the recording link, from the
 * field names the common Indian IVR / call-centre providers use. Only an http(s) recording URL is accepted (never javascript:
 * or data:), capped at 500 characters. Missing fields are null — a payload without them behaves exactly as before.
 */
export function callDetailsFrom(payload: Record<string, unknown>): { durationSec: number | null; recordingUrl: string | null } {
  const rawDur = pick(payload, ["duration", "Duration", "talk_time", "talkTime", "billsec", "DialCallDuration", "CallDuration", "call_duration", "conversation_duration"]);
  const dur = rawDur === null ? NaN : Number(rawDur);
  const rec = pick(payload, ["recording_url", "recordingUrl", "RecordingUrl", "RecordingURL", "recording", "call_recording", "CallRecording", "record_url", "audio_url", "audioUrl"]);
  const okUrl = rec !== null && rec.length <= 500 && /^https?:\/\/[^\s"'<>]+$/i.test(rec);
  return { durationSec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null, recordingUrl: okUrl ? rec : null };
}

/** A call older than this when it reaches us is history (phone was offline, or the Helper app is back-filling): logged, never replied to. */
export const BACKFILL_AFTER_MIN = 30;

/**
 * Per-call bookkeeping sent by the Sahara OS Helper app (or any provider that has an id / end time): a de-duplication id, when the call
 * ended, its direction and which phone reported it. `backfill` = history (explicit flag, or ended more than BACKFILL_AFTER_MIN ago).
 */
export function callMetaFrom(payload: Record<string, unknown>, now: Date = new Date()): { externalId: string | null; endedAt: Date | null; backfill: boolean; direction: "INCOMING" | "OUTGOING"; deviceLabel: string | null } {
  const rawId = pick(payload, ["externalId", "external_id", "call_id", "callId", "CallSid", "uuid"]);
  const externalId = rawId && /^[A-Za-z0-9:_.+@-]{1,80}$/.test(rawId) ? rawId : null;
  const rawEnd = pick(payload, ["endedAt", "ended_at", "end_time", "endTime"]);
  let endedAt: Date | null = null;
  if (rawEnd) {
    const d = /^\d{10,13}$/.test(rawEnd) ? new Date(rawEnd.length <= 10 ? Number(rawEnd) * 1000 : Number(rawEnd)) : new Date(rawEnd);
    endedAt = Number.isNaN(d.getTime()) ? null : d;
  }
  const flag = (pick(payload, ["historical", "backfill"]) ?? "").toLowerCase();
  const backfill = ["1", "true", "yes"].includes(flag) || (endedAt !== null && now.getTime() - endedAt.getTime() > BACKFILL_AFTER_MIN * 60_000);
  const direction = /out/i.test(pick(payload, ["direction", "Direction", "call_direction"]) ?? "") ? "OUTGOING" : "INCOMING";
  const label = (pick(payload, ["deviceLabel", "device_label", "agent", "device"]) ?? "").replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 40).trim();
  return { externalId, endedAt, backfill, direction, deviceLabel: label || null };
}

/** Recording uploads stop for good after CALL_RECORDING_UPLOADS_UNTIL (YYYY-MM-DD, IST, inclusive). Unset = open. */
export function recordingUploadsOpen(until: string | null | undefined, now: Date = new Date()): boolean {
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until.trim())) return true;
  return istYmd(now) <= until.trim();
}

/** "134" → "2m 14s", "45" → "45s". */
export function formatTalkTime(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
}

/** YYYY-MM-DD in IST. */
export function istYmd(now: Date): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function ymdValid(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** "5 Nov 2026" */
export function prettyDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

export function nextDay(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
}

/** Festival "fully booked" window from FESTIVAL_FULL_UNTIL — active only up to and including that IST date. */
export function festivalWindow(fullUntil: string | null | undefined, now: Date): { fullUntil: string; reopen: string } | null {
  if (!ymdValid(fullUntil)) return null;
  return istYmd(now) <= fullUntil ? { fullUntil, reopen: nextDay(fullUntil) } : null;
}

export type AutoReplyPlan = {
  template: AutoReplyTemplate;
  /** Body {{n}} values, in order. */
  bodyParams: string[];
  /** Logged preview (what the customer reads). */
  preview: string;
  /** DLT SMS text — must match the DLT-registered template word for word (variables filled). */
  sms: string;
  smsTemplateEnv: "DLT_TEMPLATE_FESTIVAL_FULL" | "DLT_TEMPLATE_MISSED_CALL";
};

const BOOK = CALL_BOOKING_URL;

/** The logged preview = the approved template body with its {{n}} values filled (single source: whatsapp-cloud-templates.ts). */
export function previewFor(template: AutoReplyTemplate, params: string[]): string {
  const t = templateByName(template);
  return t ? renderTemplatePreview(t, params) : params.join(" ");
}

/**
 * What to send for one call — or null (answered call outside a festival window, invalid / protected number).
 * `name` is the customer's first name when we know them, else "there".
 */
export function planAutoReply(input: { event: CallEvent; caller: string | null; now: Date; festivalFullUntil?: string | null; name?: string | null }): AutoReplyPlan | null {
  if (!input.caller || isProtectedNumber(input.caller)) return null;
  const fest = festivalWindow(input.festivalFullUntil, input.now);
  if (fest) {
    const a = prettyDate(fest.fullUntil);
    const b = prettyDate(fest.reopen);
    return {
      template: "festival_booking_full_notice",
      bodyParams: [a, b],
      preview: previewFor("festival_booking_full_notice", [a, b]),
      sms: `Sahara Cleaning: Festival rush - all slots booked till ${a}. Book for ${b} onwards: ${BOOK} Rated ${TRUST.rating}/5 on Google. Call 8956567130 -SAHARA`,
      smsTemplateEnv: "DLT_TEMPLATE_FESTIVAL_FULL",
    };
  }
  if (input.event !== "MISSED") return null;
  const name = (input.name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    template: "missed_call_auto_responder",
    bodyParams: [name],
    preview: previewFor("missed_call_auto_responder", [name]),
    sms: `Sahara Cleaning: Sorry we missed your call. We will call you back shortly. Book your slot now: ${BOOK} Call 8956567130 -SAHARA`,
    smsTemplateEnv: "DLT_TEMPLATE_MISSED_CALL",
  };
}

/** SMS delivery mode: "always" = WhatsApp + SMS together (default, owner spec); "fallback" = SMS only if WhatsApp fails. */
export function smsMode(env: string | undefined): "always" | "fallback" | "off" {
  const v = (env ?? "").trim().toLowerCase();
  return v === "fallback" ? "fallback" : v === "off" ? "off" : "always";
}
