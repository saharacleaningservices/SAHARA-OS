import { createHmac, timingSafeEqual } from "node:crypto";
import { parseCtwaReferral, ctwaLeadFields, describeCtwa, type CtwaReferral } from "@/lib/whatsapp-referral";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  applyWhatsAppStatus,
  findLeadForNumber,
  findLeadsForMobile,
  last10Digits,
  recordInboundWhatsApp,
  sendWhatsApp as sendWhatsAppNow,
  sendWhatsAppInteractiveList as sendWhatsAppInteractiveListNow,
  setWhatsAppOptOut,
  setWhatsAppOptIn,
} from "@/lib/whatsapp";
import { getCompanySettings } from "@/server/settings";
import { GALLERY_PUBLIC_URL } from "@/lib/gallery";
import { moreOptionsListMessage } from "@/lib/whatsapp-templates";
import { COMPANY } from "@/lib/constants";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";
import { answerWhatsApp, HANDOFF_ACK } from "@/server/whatsapp-ai";
import { setConversationMode } from "@/server/whatsapp-access";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "@/lib/whatsapp-keywords";
import { botMenu, botReply, isBotRow, isBotTrigger, NEW_ENQUIRY_OPENING } from "@/lib/whatsapp-chatbot";

// Grounded AI assistant — off unless explicitly enabled.
const AI_ENABLED = process.env.WHATSAPP_AI_ENABLED === "on";

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body,
 * keyed with the Meta App Secret) so this endpoint only trusts payloads that
 * genuinely came from Meta — found missing in the 2026-09-21 security audit
 * (without this, anyone could POST an arbitrary payload and, among other
 * things, make sendWhatsApp() queue/send a message to any phone number they
 * specify). Skips verification (not a rejection) when WHATSAPP_APP_SECRET
 * isn't configured yet, matching this project's "queue always, deliver/
 * verify only when configured" pattern — there's no real inbound Meta
 * traffic to protect until the Cloud API is actually connected, and this
 * activates automatically the moment that secret is set.
 */
function isValidMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  // In production an unsigned/unverifiable webhook is never trusted: without
  // the App Secret anyone could post fake inbound messages. Local dev (no
  // secret) still accepts so the handler can be exercised.
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

// Meta WhatsApp Cloud API webhook — receives inbound customer messages and
// delivery-status callbacks for every message sendWhatsApp() sends (see
// src/lib/whatsapp.ts). Registering this URL + verify token in the Meta App
// dashboard (Configuration → Webhooks → WhatsApp → Manage) is a one-time
// setup step for whoever holds Meta Business Manager access — that account
// creation / dashboard step is explicitly out of scope for this build, same
// as the 5000+ customer bulk broadcast. This route only needs to exist and
// behave correctly so that step, whenever it happens, just works:
//
// Callback URL: https://crm.saharacleaningservices.com/api/webhooks/whatsapp
// (this route is served identically from any domain pointed at this
// deployment, so the legacy app.saharacleaningservices.com URL keeps
// working too until the crm.* domain is confirmed live)
// Verify token: whatever value is set as WHATSAPP_WEBHOOK_VERIFY_TOKEN
//               in the Coolify environment (Settings → Environment
//               Variables on the app) — pick any long random string and
//               paste the same value into the Meta dashboard field.
// Subscribe to: messages (for the Quick Reply button auto-replies and the
//               STOP/START opt-out handling below)

export const dynamic = "force-dynamic";

// Pre-go-live guard: every customer-facing message this webhook would send
// on its own (new-inquiry acknowledgement, STOP/START confirmations, MORE
// list, quick-reply answers) is suppressed unless WHATSAPP_AUTO_REPLIES=on.
// Suppressed means neither sent nor queued, so nothing can flush later.
// Opt-out/opt-in state, lead creation and timeline notes still happen.
const AUTO_REPLIES_ENABLED = process.env.WHATSAPP_AUTO_REPLIES === "on";

async function sendWhatsApp(input: Parameters<typeof sendWhatsAppNow>[0]) {
  if (!AUTO_REPLIES_ENABLED) {
    console.info("[whatsapp webhook] auto-reply suppressed (WHATSAPP_AUTO_REPLIES is not on)", input.kind);
    return null;
  }
  return sendWhatsAppNow(input);
}

async function sendWhatsAppInteractiveList(input: Parameters<typeof sendWhatsAppInteractiveListNow>[0]) {
  if (!AUTO_REPLIES_ENABLED) {
    console.info("[whatsapp webhook] auto-reply suppressed (WHATSAPP_AUTO_REPLIES is not on)", input.kind);
    return null;
  }
  return sendWhatsAppInteractiveListNow(input);
}

/**
 * GET — Meta's one-time verification handshake. Meta calls this with
 * hub.mode=subscribe, hub.verify_token=<the value pasted into the
 * dashboard>, and hub.challenge=<random string>; we must echo hub.challenge
 * back as plain text if the token matches, or reject with 403 otherwise.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type MetaStatusError = { title?: string; message?: string };
type MetaStatus = { id?: string; status?: string; timestamp?: string; errors?: MetaStatusError[] };
type MetaInboundMessage = {
  id?: string;
  from?: string;
  type?: string;
  /** Present on the first message of a Click-to-WhatsApp ad conversation. */
  referral?: unknown;
  button?: { text?: string; payload?: string };
  text?: { body?: string };
  interactive?: { type?: string; list_reply?: { id?: string; title?: string }; button_reply?: { id?: string; title?: string } };
};
type MetaContact = { wa_id?: string; profile?: { name?: string } };
type MetaChangeValue = { messages?: MetaInboundMessage[]; statuses?: MetaStatus[]; contacts?: MetaContact[] };
type MetaChange = { value?: MetaChangeValue };
type MetaEntry = { changes?: MetaChange[] };
type MetaWebhookPayload = { entry?: MetaEntry[] };

// Meta Cloud API policy requires honoring an opt-out reply immediately, and
// symmetrically an opt-in reply resubscribes. Matched on the whole trimmed
// message body (case-insensitive) so a customer just typing "stop" — not a
// sentence that happens to contain it — is what triggers this.
// (Keyword patterns live in src/lib/whatsapp-keywords.ts — "CANCEL" is a
// booking request, not an unsubscribe.)
const MORE_OPTIONS_KEYWORDS = /^more$/i;

async function sendMoreOptionsList(toNumber: string, messageId?: string) {
  const list = moreOptionsListMessage();
  await sendWhatsAppInteractiveList({
    kind: "OTHER",
    toNumber,
    bodyText: list.bodyText,
    buttonLabel: list.buttonLabel,
    rows: list.rows,
    relatedType: "WhatsAppWebhook",
    relatedId: messageId,
  });
}

/**
 * POST — several things land here:
 *
 * 1. Plain-text STOP/UNSUBSCRIBE (and START/SUBSCRIBE to reverse it) —
 *    flips WhatsAppConsent (see src/lib/whatsapp.ts) and sends exactly one
 *    confirmation reply, bypassing the opt-out gate for that one reply only
 *    (skipConsentCheck) so the confirmation itself isn't blocked by the
 *    opt-out it's confirming.
 * 2. Plain-text MORE — the degraded, pre-Cloud-API path for "More Options"
 *    (see premiumBookingConfirmationMessage in whatsapp-templates.ts, which
 *    tells the customer to reply MORE instead of showing a phone number).
 *    Answered with the same interactive list a real "More Options" button
 *    tap sends (see #3) — sendWhatsAppInteractiveList degrades to a queued,
 *    unsent row if the Cloud API isn't connected yet, same as every other
 *    send in this app.
 * 3. Quick Reply / button taps on the booking-confirmation template:
 *    "More Options" (current) sends the interactive list of 7 options;
 *    "Before / After Photos" and "Give Google Review" (the older 4-button
 *    template still valid for messages already sent under it) keep working
 *    exactly as before — nothing that already worked regresses.
 * 4. Interactive LIST replies — a customer tapping one of the 7 More
 *    Options rows (Reschedule / Pay After Service / Add to Calendar /
 *    Google Review / Before-After Photos / Call Support / WhatsApp
 *    Support). Call Support / WhatsApp Support are the only two places the
 *    company phone number is ever sent — by design, it's never in the
 *    initial confirmation message (Phase 5 readiness instruction).
 * 5. Delivery-status callbacks (sent/delivered/read/failed) are matched to
 *    the outbound WhatsAppMessage row by providerMessageId and stamp
 *    sentAt / deliveredAt / readAt, or mark it FAILED (applyWhatsAppStatus).
 * 6. Every inbound message is logged (direction INBOUND) for the WhatsApp
 *    Inbox and linked to the customer's latest lead; Meta redeliveries of
 *    the same message id are ignored.
 *
 * Always resolves fast with 200 — Meta disables a webhook that times out or
 * errors repeatedly, and a malformed/unexpected payload is never the
 * customer's fault.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!isValidMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        await Promise.all([handleInboundMessages(value), handleStatuses(value)]);
      }
    }
  } catch (err) {
    console.error("[whatsapp webhook] processing error", err);
  }

  return NextResponse.json({ ok: true });
}

async function handleStatuses(value: MetaChangeValue) {
  for (const s of value.statuses ?? []) {
    if (!s.id || !s.status) continue;
    await applyWhatsAppStatus({
      providerMessageId: s.id,
      status: s.status,
      timestamp: s.timestamp,
      error: s.errors?.[0]?.title || s.errors?.[0]?.message,
    }).catch(() => {});
  }
}

async function handleInboundMessages(value: MetaChangeValue) {
  const messages = value.messages ?? [];
  if (messages.length === 0) return;

  const settings = await getCompanySettings().catch(() => null);
  const reviewUrl = settings?.googleReviewUrl || "";

  for (const m of messages) {
    if (!m.from) continue;

    // Log every inbound message for the WhatsApp Inbox, mapped to the
    // customer's latest lead. A redelivered webhook (same Meta message id)
    // is skipped entirely so it can't trigger duplicate replies or leads.
    const profileName = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
    const inboundText =
      m.text?.body || m.button?.text || m.interactive?.list_reply?.title || m.interactive?.button_reply?.title || `(${m.type || "message"})`;
    const inbound = await recordInboundWhatsApp({ from: m.from, providerMessageId: m.id, body: inboundText, profileName }).catch(() => undefined);
    if (inbound === null) continue;
    await processInboundMessage({ ...m, from: m.from }, reviewUrl, profileName);
    if (inbound && !inbound.relatedId) {
      // A brand-new inquiry creates its lead during processing — link it now.
      const lead = await findLeadForNumber(m.from);
      if (lead) await db.whatsAppMessage.update({ where: { id: inbound.id }, data: { relatedType: "Lead", relatedId: lead.id } }).catch(() => {});
    }
  }
}

/** The original per-message routing (opt-out/in, MORE, inquiries, quick replies). */
async function processInboundMessage(m: MetaInboundMessage & { from: string }, reviewUrl: string, profileName: string | null = null) {
  {
    if (m.type === "text") {
      const body = (m.text?.body || "").trim();
      if (OPT_OUT_KEYWORDS.test(body)) {
        await setWhatsAppOptOut(m.from, "CUSTOMER_REPLY", `Replied "${body}"`);
        await sendWhatsApp({
          kind: "OTHER",
          toNumber: m.from,
          body: "You've been unsubscribed from Sahara Cleaning Services WhatsApp messages. Reply START to resubscribe any time.",
          relatedType: "WhatsAppWebhook",
          relatedId: m.id,
          skipConsentCheck: true,
        });
      } else if (OPT_IN_KEYWORDS.test(body)) {
        await setWhatsAppOptIn(m.from);
        await sendWhatsApp({
          kind: "OTHER",
          toNumber: m.from,
          body: "You're resubscribed to Sahara Cleaning Services WhatsApp updates. Reply STOP any time to opt out again.",
          relatedType: "WhatsAppWebhook",
          relatedId: m.id,
          skipConsentCheck: true,
        });
      } else if (MORE_OPTIONS_KEYWORDS.test(body)) {
        await sendMoreOptionsList(m.from, m.id);
      } else if (body && isBotTrigger(body) && !AI_ENABLED) {
        // In-house booking chatbot (owner 2026-10-26): greetings / "price" / "book" get the service menu.
        // The enquiry is still logged (lead / timeline) — without the plain acknowledgement, the menu is the reply.
        await handleWhatsAppInquiry(m.from, body, profileName, parseCtwaReferral(m.referral), { silent: true });
        await sendBotMenu(m.from, m.id);
      } else if (body) {
        // Any other free-text inbound message is a genuine new inquiry
        // (Phase 7 CRM automation trigger, 2026-09-21: "WhatsApp inquiry").
        // Mirrors the missed-call auto-lead pattern (src/app/api/webhook/
        // missed-call/route.ts) — same dedup logic, same auto-lead shape —
        // so a customer already mid-conversation about an open enquiry or
        // job doesn't get a duplicate Lead created for every message.
        await handleWhatsAppInquiry(m.from, body, profileName, parseCtwaReferral(m.referral));
        await aiRespond(m.from, body);
      }
      return;
    }

    const tapped = m.interactive?.list_reply?.id || m.interactive?.button_reply?.id;
    // "Booking / Crew Status" menu row: the customer's own latest job (matched on the sending number). Shows date,
    // slot, status and the supervisor's first name only — never amounts or other customers' data.
    if (m.type === "interactive" && tapped === "bot_status") {
      const tail = m.from.replace(/\D/g, "").slice(-10);
      const job = tail.length === 10
        ? await db.job.findFirst({
            where: { deletedAt: null, customerMobile: { endsWith: tail }, status: { not: "CANCELLED" } },
            orderBy: { scheduledDate: "desc" },
            select: { jobNumber: true, scheduledDate: true, scheduledTime: true, status: true, supervisor: { select: { name: true } } },
          })
        : null;
      const label: Record<string, string> = {
        PENDING: "Confirmed — crew being assigned",
        ASSIGNED: "Confirmed — crew assigned",
        REACTIVATED: "Confirmed — crew assigned",
        ON_THE_WAY: "Crew is on the way",
        STARTED: "Work in progress",
        COMPLETED: "Completed",
        POSTPONED: "Postponed — our team will call to reschedule",
      };
      const body = job
        ? `📋 *Booking ${job.jobNumber}*\nDate: ${job.scheduledDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })}\nSlot: ${job.scheduledTime}\nStatus: ${label[job.status] ?? job.status}${job.supervisor?.name ? `\nSupervisor: ${job.supervisor.name.split(" ")[0]}` : ""}\n\nNeed a change? Reply here and our team will help.`
        : botReply("bot_status");
      if (body) await sendWhatsApp({ kind: "OTHER", toNumber: m.from, body, relatedType: "WhatsAppChatbot", relatedId: m.id });
      return;
    }

    if (m.type === "interactive" && isBotRow(tapped)) {
      const reply = botReply(tapped!);
      if (reply) await sendWhatsApp({ kind: "OTHER", toNumber: m.from, body: reply, relatedType: "WhatsAppChatbot", relatedId: m.id });
      return;
    }

    if (m.type === "interactive" && m.interactive?.list_reply?.id) {
      await handleMoreOptionsSelection(m.interactive.list_reply.id, m.from, m.id, reviewUrl);
      return;
    }

    if (m.type !== "button" || !m.button?.text) return;
    const from = m.from;
    const label = m.button.text;

    if (/more\s*options/i.test(label)) {
      await sendMoreOptionsList(from, m.id);
      return;
    }

    // Booking-confirmation quick reply: record the customer's choice on
    // their next upcoming job (data change only — nothing is marked paid).
    if (/pay\s*after\s*service/i.test(label)) {
      const job = await db.job.findFirst({
        where: {
          customerMobile: { endsWith: from.replace(/\D/g, "").slice(-10) },
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
        orderBy: { scheduledDate: "asc" },
      });
      if (job) {
        await db.job.update({ where: { id: job.id }, data: { paymentPreference: "PAY_AFTER_SERVICE" } });
        await db.activityLog.create({ data: { jobId: job.id, action: "Customer chose Pay After Service (WhatsApp)" } }).catch(() => {});
      }
      await sendWhatsApp({
        kind: "OTHER",
        toNumber: from,
        body: "Noted — you can pay after the service is completed. Our team will share the payment details once the job is done.",
        relatedType: "WhatsAppWebhook",
        relatedId: m.id,
      });
      return;
    }

    // Marketing templates' "Stop promotions": marketing opt-out only —
    // booking and service messages keep working.
    if (/stop\s*promotions?/i.test(label)) {
      const mobile = from.replace(/\D/g, "").slice(-10);
      await db.lead
        .updateMany({ where: { OR: [{ mobile }, { whatsapp: mobile }] }, data: { marketingConsent: "OPTED_OUT", marketingConsentAt: new Date() } })
        .catch(() => {});
      await sendWhatsApp({
        kind: "OTHER",
        toNumber: from,
        body: "You won't receive promotional messages from Sahara Cleaning Services any more. Booking updates will still reach you.",
        relatedType: "WhatsAppWebhook",
        relatedId: m.id,
      });
      return;
    }

    // Older 4-button template's Quick Replies — kept working for any
    // message already sent/in-flight under booking_confirmation_v1.
    if (/before.*after|gallery|photo/i.test(label)) {
      await sendWhatsApp({
        kind: "OTHER",
        toNumber: from,
        body: `Here are our Before/After photos: ${GALLERY_PUBLIC_URL}`,
        relatedType: "WhatsAppWebhook",
        relatedId: m.id,
      });
      return;
    }

    if (/review/i.test(label)) {
      const body = reviewUrl
        ? `Thank you! We'd really appreciate a quick Google review: ${reviewUrl}`
        : `Thank you! Our team will share the review link shortly.`;
      await sendWhatsApp({
        kind: "REVIEW_REQUEST",
        toNumber: from,
        body,
        relatedType: "WhatsAppWebhook",
        relatedId: m.id,
      });
    }
  }
}

/** WhatsApp profile name → safe lead name (or null): no control chars, no bare numbers, max 60 chars. */
function cleanProfileName(name: string | null | undefined): string | null {
  const n = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return n && /[\p{L}]/u.test(n) ? n : null;
}

const istDay = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const isUniqueViolation = (e: unknown, field: string) => {
  const err = e as { code?: string; meta?: { target?: unknown } };
  return err?.code === "P2002" && String(err.meta?.target ?? "").includes(field);
};

/**
 * WhatsApp → ONE Lead. Never confirms a booking — the lead starts at NEW for
 * office qualification.
 *  1. Same customer (mobile / WhatsApp / alternate number, any stored format)
 *     with an open enquiry, or a lead created in the last 24 hours → timeline
 *     note on that lead, no new lead.
 *  2. Same customer with an active job (booked, not completed/cancelled) →
 *     note on that job's lead (or the job's activity log), no new lead.
 *  3. Otherwise create one NEW lead (source WHATSAPP) + 15-minute follow-up +
 *     team alert. `intakeKey` (unique: WA:<mobile>:<IST day>) makes this
 *     idempotent: if two messages race, the database lets only one insert
 *     win and the other becomes a timeline note on the winner.
 * Existing leads and jobs are never modified (only notes are added).
 */
/** Chatbot service menu — skipped while a human has taken over the conversation in the WhatsApp Inbox. */
async function sendBotMenu(toNumber: string, messageId?: string, opening?: string) {
  const conv = await db.whatsAppConversation.findUnique({ where: { number: toNumber.replace(/\D/g, "") } }).catch(() => null);
  if (conv && conv.mode === "HUMAN") return null;
  const menu = botMenu(opening);
  return sendWhatsAppInteractiveList({ kind: "OTHER", toNumber, bodyText: menu.bodyText, buttonLabel: menu.buttonLabel, rows: menu.rows, relatedType: "WhatsAppChatbot", relatedId: messageId });
}

async function handleWhatsAppInquiry(from: string, body: string, profileName: string | null = null, ad: CtwaReferral | null = null, opts: { silent?: boolean } = {}) {
  const mobile = last10Digits(from);
  if (mobile.length !== 10) return;
  const adLine = ad ? ` · ${describeCtwa(ad)}` : "";
  const note = `Inbound WhatsApp: "${body.slice(0, 300)}"${adLine}`;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = (await findLeadsForMobile(mobile)).find((l) => !["COMPLETED", "CANCELLED"].includes(l.stage) || l.createdAt >= dayAgo);
  if (recent) {
    await addTimelineEntry({ leadId: recent.id, type: "NOTE", body: note }).catch(() => {});
    return;
  }

  const tail = mobile.slice(-4);
  const activeJob = (
    await db.job.findMany({
      where: { deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, OR: [{ customerMobile: { contains: tail } }, { alternateMobile: { contains: tail } }] },
      orderBy: { scheduledDate: "asc" },
      take: 50,
      select: { id: true, leadId: true, customerMobile: true, alternateMobile: true },
    })
  ).find((j) => last10Digits(j.customerMobile) === mobile || last10Digits(j.alternateMobile) === mobile);
  if (activeJob) {
    if (activeJob.leadId) await addTimelineEntry({ leadId: activeJob.leadId, type: "NOTE", body: note }).catch(() => {});
    else await db.activityLog.create({ data: { jobId: activeJob.id, action: note.slice(0, 300) } }).catch(() => {});
    return;
  }

  const intakeKey = `WA:${mobile}:${istDay()}`;
  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const displayName = existingCustomer?.name || cleanProfileName(profileName);
  let lead: { id: string; leadNumber: string } | null = null;
  for (let attempt = 0; attempt < 3 && !lead; attempt++) {
    try {
      lead = await db.lead.create({
        data: {
          leadNumber: await generateLeadNumber(),
          intakeKey,
          name: displayName || `WhatsApp inquiry ${mobile}`,
          mobile,
          whatsapp: mobile,
          area: existingCustomer?.area || "—",
          address: existingCustomer?.address || null,
          service: "HOME_DEEP_CLEANING" as never,
          source: "WHATSAPP" as never,
          // Attribution for the Marketing dashboard (was left empty → "Not tracked").
          ...(ad
            ? ctwaLeadFields(ad)
            : {
                acquisitionChannel: "WhatsApp Direct",
                firstTouchSource: "WhatsApp Direct",
                firstTouchAt: new Date(),
                latestTouchSource: "WhatsApp Direct",
                latestTouchAt: new Date(),
              }),
          stage: "NEW",
          notes: `Auto-created from an inbound WhatsApp message: "${body.slice(0, 300)}"${adLine}${ad?.ctwaClid ? ` · ctwa_clid ${ad.ctwaClid}` : ""}`,
        },
        select: { id: true, leadNumber: true },
      });
    } catch (e) {
      if (isUniqueViolation(e, "intakeKey")) {
        // Another message from this customer created the lead a moment ago.
        const winner = await db.lead.findUnique({ where: { intakeKey }, select: { id: true } });
        if (winner) await addTimelineEntry({ leadId: winner.id, type: "NOTE", body: note }).catch(() => {});
        return;
      }
      if (!isUniqueViolation(e, "leadNumber")) throw e; // a different customer took the same LD number — retry
    }
  }
  if (!lead) return;
  const leadNumber = lead.leadNumber;

  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "WHATSAPP", priority: "HIGH", notes: "New WhatsApp inquiry — reply and qualify" } })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "NOTE", body: `Inbound WhatsApp — lead auto-created: "${body.slice(0, 300)}"${adLine}` }).catch(() => {});
  await notify({
    kind: "NEW_INQUIRY",
    title: ad ? `📣 Ad lead on WhatsApp — ${displayName || mobile}` : `💬 WhatsApp inquiry — ${displayName || mobile}`,
    body: `Auto-lead ${leadNumber} · "${body.slice(0, 100)}"${ad ? ` · from a Meta ad${ad.headline ? `: ${ad.headline}` : ""}` : ""}`,
    href: `/leads/${lead.id}`,
  }).catch(() => {});

  // When the grounded AI assistant is on, it answers instead (no double reply); a chatbot trigger sends its own menu.
  if (AI_ENABLED || opts.silent) return;
  // Owner 2026-10-26: the acknowledgement IS the chatbot menu (one message): thanks + 4 services → direct booking links.
  await sendBotMenu(from, undefined, NEW_ENQUIRY_OPENING);
}

/**
 * Grounded AI assistant reply (src/server/whatsapp-ai.ts). Runs only when
 * WHATSAPP_AI_ENABLED=on and the conversation is not under human takeover.
 * New conversations start in AI mode; a handoff switches the conversation to
 * HUMAN, sends one short acknowledgement and alerts the team. Replies still
 * go through the auto-reply guard (WHATSAPP_AUTO_REPLIES) above.
 */
async function aiRespond(from: string, body: string) {
  if (!AI_ENABLED) return;
  const number = from.replace(/\D/g, "");
  const existing = await db.whatsAppConversation.findUnique({ where: { number } });
  if (existing && existing.mode !== "AI") return; // human takeover — AI stays silent
  if (!existing) await setConversationMode(number, "AI", "Sahara Assistant (AI)", "new conversation");

  const result = answerWhatsApp(body);
  const text = result.reply ?? HANDOFF_ACK;
  const sent = await sendWhatsApp({ kind: "OTHER", toNumber: from, body: text, relatedType: "WhatsAppWebhook" });
  if (sent && "id" in sent && sent.id) {
    await db.whatsAppMessage.update({ where: { id: sent.id }, data: { sentByName: "Sahara Assistant (AI)" } }).catch(() => {});
  }
  if (result.handoff) {
    await setConversationMode(number, "HUMAN", "Sahara Assistant (AI)", result.handoff);
    await notify({
      kind: "NEW_INQUIRY",
      title: `🙋 WhatsApp handoff — +${number}`,
      body: `AI handed over: ${result.handoff} · "${body.slice(0, 80)}"`,
      href: `/admin/whatsapp-inbox?n=${number}`,
    }).catch(() => {});
  }
}

/**
 * Routes one of the 7 More Options list-row taps to its response. Call
 * Support / WhatsApp Support are the only two places the company phone
 * number is ever sent to a customer in this whole flow — deliberately not
 * in the initial confirmation message (Phase 5 readiness instruction).
 * Reschedule / Pay After Service are acknowledged and left for a real staff
 * follow-up (this build automates the message, not the scheduling change
 * itself — see SAHARA_OS_STATUS.md's WhatsApp readiness entry).
 */
async function handleMoreOptionsSelection(rowId: string, from: string, messageId: string | undefined, reviewUrl: string) {
  const send = (body: string, kind: Parameters<typeof sendWhatsApp>[0]["kind"] = "OTHER") =>
    sendWhatsApp({ kind, toNumber: from, body, relatedType: "WhatsAppWebhook", relatedId: messageId });

  switch (rowId) {
    case "reschedule":
      await send("No problem! Please reply with your preferred new date and time, and our team will confirm shortly.");
      break;
    case "pay_after_service":
      await send("Sure — you can pay once the service is completed. Our team will share the payment link/QR after the job is done.");
      break;
    case "add_to_calendar":
      await send(
        "Add this to your calendar: https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
          encodeURIComponent(`${COMPANY.name} — Cleaning Service`),
      );
      break;
    case "google_review":
      await send(
        reviewUrl
          ? `Thank you! We'd really appreciate a quick Google review: ${reviewUrl}`
          : "Thank you! Our team will share the review link shortly.",
        "REVIEW_REQUEST",
      );
      break;
    case "before_after_photos":
      await send(`Here are our Before/After photos: ${GALLERY_PUBLIC_URL}`);
      break;
    case "call_support":
      await send(`You can reach us at ${COMPANY.phones[0]} — happy to help!`);
      break;
    case "whatsapp_support":
      await send(`You're already chatting with us here! You can also WhatsApp us directly at ${COMPANY.phones[0]}.`);
      break;
  }
}
