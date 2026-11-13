// Website "tap to call" tracking (owner 2026-11-13). Pure helpers, no DB: the browser listener decides which links count,
// the server route builds the CRM lead from the visitor's attribution, and the dashboard flags leads nobody has called back.

import { classifyTouch, sanitizeTouch, type AttributionPayload, type Touch } from "@/lib/attribution";
import { sourceLabelForTag } from "@/lib/source-label";
import { sourceTagForChannel } from "@/lib/source-tags";
import { CONTACT } from "@/lib/marketing-content";

/** A lead nobody has called within this long is flagged "Pending Follow-up" on the admin dashboard. */
export const CALL_FOLLOWUP_MINUTES = 15;
/** Only taps on Sahara's own lines are logged (never a stray tel: link). */
export const SAHARA_CALL_LINES: readonly string[] = [...CONTACT.call, "7083347130"];
/** Header that starts the lead name / notes of every tap-to-call lead, so staff and reports can find them. */
export const CALL_CLICK_HEADER = "[CALL-CLICK]";
/** Placeholder mobile: a tel: tap tells us nothing about the caller. Staff replace it once they know the number. */
export const CALL_CLICK_MOBILE = "0000000000";

/** The dialled digits of a tel: href ("tel:+918956567130" → "8956567130"), or null for anything that is not a 10-digit Indian line. */
export function dialledLine(href: string | null | undefined): string | null {
  const h = (href ?? "").trim();
  if (!/^tel:/i.test(h)) return null;
  const digits = decodeURIComponent(h.slice(4)).replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 10 ? digits : null;
  return ten && /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

/** The touch that explains this tap: the latest one when it carries a real signal (UTM / click id / referrer), else the first. */
export function touchForCall(p: AttributionPayload | null | undefined): Touch | null {
  const latest = p?.latest ?? null;
  const first = p?.first ?? null;
  const hasSignal = (t: Touch | null) => Boolean(t && (t.source || t.gclid || t.fbclid || t.referrer));
  return hasSignal(latest) ? latest : first ?? latest;
}

export type CallClickSource = { channel: string; sourceTag: string | null; header: "[GOOGLE-ADS]" | "[META-ADS]" | "[SEO-WEB]" | string; label: string };

/** Google Ads / Meta Ads / GBP keep their own header; every other website visit reads [SEO-WEB]. */
export function callClickSource(touch: Touch | null | undefined): CallClickSource {
  const channel = classifyTouch(touch ?? null);
  const sourceTag = sourceTagForChannel(channel, touch?.campaign, touch?.medium);
  if (!sourceTag) return { channel: channel === "Unattributed" ? "Website Direct" : channel, sourceTag: null, header: "[SEO-WEB]", label: "Website / SEO" };
  const l = sourceLabelForTag(sourceTag, touch?.landingPage);
  // Campaign-numbered tags ([GOOGLE-ADS-G3]) collapse to the plain family header the owner asked for.
  const header = /^\[GOOGLE-ADS/.test(l.header) ? "[GOOGLE-ADS]" : /^\[META-ADS/.test(l.header) ? "[META-ADS]" : l.header;
  return { channel, sourceTag, header, label: l.label };
}

const IST = { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true } as const;
export const istStamp = (d: Date) => `${d.toLocaleString("en-IN", IST)} IST`;

export type CallClickInput = { line: string; page: string; attribution: AttributionPayload };

/** Validates the beacon body. Anything that is not a tel: tap on a Sahara line is rejected. */
export function parseCallClick(body: unknown): CallClickInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const line = dialledLine(typeof o.href === "string" ? o.href.slice(0, 60) : null);
  if (!line || !SAHARA_CALL_LINES.includes(line)) return null;
  const a = (o.attribution && typeof o.attribution === "object" ? o.attribution : {}) as Record<string, unknown>;
  const page = typeof o.page === "string" ? o.page.split(/[?#]/)[0]!.slice(0, 200) : "";
  return { line, page, attribution: { first: sanitizeTouch(a.first), latest: sanitizeTouch(a.latest) } };
}

/** One-line description used as the lead note and timeline entry. */
export function callClickNote(input: CallClickInput, src: CallClickSource, at: Date): string {
  const t = touchForCall(input.attribution);
  const utm = [t?.source && `utm_source=${t.source}`, t?.medium && `utm_medium=${t.medium}`, t?.campaign && `utm_campaign=${t.campaign}`].filter(Boolean).join(" ");
  return `${CALL_CLICK_HEADER} ${src.header} ${istStamp(at)} · tapped call on ${input.line} from ${input.page || "/"}${utm ? ` · ${utm}` : ""}`;
}

/**
 * A lead needs a call-back when it is still NEW, older than the window, and nobody has logged a call on it.
 * "Called" = a call logged by a staff member on the lead's timeline, or a finished CALL follow-up.
 */
export function isPendingFollowUp(lead: { stage: string; createdAt: Date; called: boolean }, now: Date = new Date(), minutes = CALL_FOLLOWUP_MINUTES): boolean {
  if (lead.called || lead.stage !== "NEW") return false;
  return now.getTime() - lead.createdAt.getTime() >= minutes * 60_000;
}
