import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  applyWhatsAppStatus,
  findLeadForNumber,
  recordInboundWhatsApp,
  sendWhatsApp,
  sendWhatsAppInteractiveList,
  setWhatsAppOptOut,
  setWhatsAppOptIn,
} from "@/lib/whatsapp";
import { getCompanySettings } from "@/server/settings";
import { GALLERY_PUBLIC_URL } from "@/lib/gallery";
import { moreOptionsListMessage } from "@/lib/whatsapp-templates";
import { COMPANY } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";

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
const OPT_OUT_KEYWORDS = /^(stop|unsubscribe|opt\s*out|cancel)$/i;
const OPT_IN_KEYWORDS = /^(start|subscribe|opt\s*in)$/i;
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
    await processInboundMessage({ ...m, from: m.from }, reviewUrl);
    if (inbound && !inbound.relatedId) {
      // A brand-new inquiry creates its lead during processing — link it now.
      const lead = await findLeadForNumber(m.from);
      if (lead) await db.whatsAppMessage.update({ where: { id: inbound.id }, data: { relatedType: "Lead", relatedId: lead.id } }).catch(() => {});
    }
  }
}

/** The original per-message routing (opt-out/in, MORE, inquiries, quick replies). */
async function processInboundMessage(m: MetaInboundMessage & { from: string }, reviewUrl: string) {
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
      } else if (body) {
        // Any other free-text inbound message is a genuine new inquiry
        // (Phase 7 CRM automation trigger, 2026-09-21: "WhatsApp inquiry").
        // Mirrors the missed-call auto-lead pattern (src/app/api/webhook/
        // missed-call/route.ts) — same dedup logic, same auto-lead shape —
        // so a customer already mid-conversation about an open enquiry or
        // job doesn't get a duplicate Lead created for every message.
        await handleWhatsAppInquiry(m.from, body);
      }
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

/**
 * Auto-creates a Lead from a genuine new WhatsApp inquiry, deduped exactly
 * like the missed-call webhook: if the customer already has an open-stage
 * lead or one created in the last 24 hours, this just logs a timeline
 * entry on it instead of creating a duplicate. Source is WHATSAPP (see the
 * LeadSource enum) so this is reportable the same way CALL/WEBSITE/GMB
 * sources already are.
 */
async function handleWhatsAppInquiry(from: string, body: string) {
  const mobile = from.replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return;

  const recent = await db.lead.findFirst({
    where: {
      mobile,
      deletedAt: null,
      OR: [{ stage: { notIn: ["COMPLETED", "CANCELLED"] } }, { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    await addTimelineEntry({ leadId: recent.id, type: "NOTE", body: `Inbound WhatsApp: "${body.slice(0, 300)}"` }).catch(() => {});
    return;
  }

  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: existingCustomer?.name || `WhatsApp inquiry ${mobile}`,
      mobile,
      whatsapp: mobile,
      area: existingCustomer?.area || "—",
      address: existingCustomer?.address || null,
      service: "HOME_DEEP_CLEANING" as never,
      source: "WHATSAPP" as never,
      stage: "NEW",
      notes: `Auto-created from an inbound WhatsApp message: "${body.slice(0, 300)}"`,
    },
  });

  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "WHATSAPP", priority: "HIGH", notes: "New WhatsApp inquiry — reply and qualify" } })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "NOTE", body: `Inbound WhatsApp — lead auto-created: "${body.slice(0, 300)}"` }).catch(() => {});
  await notify({
    kind: "NEW_INQUIRY",
    title: `💬 WhatsApp inquiry — ${existingCustomer?.name || mobile}`,
    body: `Auto-lead ${leadNumber} · "${body.slice(0, 100)}"`,
    href: `/leads/${lead.id}`,
  }).catch(() => {});

  await sendWhatsApp({
    kind: "OTHER",
    toNumber: from,
    body: `Thanks for reaching out to ${COMPANY.name}! Our team will get back to you shortly. Meanwhile, you can book directly here: ${PUBLIC_BOOKING_URL}/book`,
    relatedType: "Lead",
    relatedId: lead.id,
  });
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
