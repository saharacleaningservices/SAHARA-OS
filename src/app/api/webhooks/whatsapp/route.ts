import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWhatsApp, setWhatsAppOptOut, setWhatsAppOptIn } from "@/lib/whatsapp";
import { getCompanySettings } from "@/server/settings";
import { GALLERY_PUBLIC_URL } from "@/lib/gallery";

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
  if (!secret) return true;
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
// Callback URL: https://app.saharacleaningservices.com/api/webhooks/whatsapp
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
type MetaStatus = { id?: string; status?: string; errors?: MetaStatusError[] };
type MetaInboundMessage = {
  id?: string;
  from?: string;
  type?: string;
  button?: { text?: string; payload?: string };
  text?: { body?: string };
};
type MetaChangeValue = { messages?: MetaInboundMessage[]; statuses?: MetaStatus[] };
type MetaChange = { value?: MetaChangeValue };
type MetaEntry = { changes?: MetaChange[] };
type MetaWebhookPayload = { entry?: MetaEntry[] };

// Meta Cloud API policy requires honoring an opt-out reply immediately, and
// symmetrically an opt-in reply resubscribes. Matched on the whole trimmed
// message body (case-insensitive) so a customer just typing "stop" — not a
// sentence that happens to contain it — is what triggers this.
const OPT_OUT_KEYWORDS = /^(stop|unsubscribe|opt\s*out|cancel)$/i;
const OPT_IN_KEYWORDS = /^(start|subscribe|opt\s*in)$/i;

/**
 * POST — three things land here:
 *
 * 1. Plain-text STOP/UNSUBSCRIBE (and START/SUBSCRIBE to reverse it) —
 *    flips WhatsAppConsent (see src/lib/whatsapp.ts) and sends exactly one
 *    confirmation reply, bypassing the opt-out gate for that one reply only
 *    (skipConsentCheck) so the confirmation itself isn't blocked by the
 *    opt-out it's confirming.
 * 2. Quick Reply button taps on the booking-confirmation template ("Before /
 *    After Photos" and "Give Google Review" — see
 *    BOOKING_CONFIRMATION_META_TEMPLATE in whatsapp-templates.ts) arrive as
 *    inbound type:"button" messages. A Quick Reply button carries no URL of
 *    its own, so we auto-reply with the real link the button promised.
 * 3. Delivery-status callbacks (sent/delivered/read/failed) are matched to
 *    the WhatsAppMessage row by providerMessageId. Only "failed" is
 *    persisted — WhatsAppStatus only models QUEUED/SENT/FAILED today, so a
 *    "delivered"/"read" callback is acknowledged (200) without a schema
 *    change.
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
    if (s.status !== "failed" || !s.id) continue;
    const reason = s.errors?.[0]?.title || s.errors?.[0]?.message || "Delivery failed (Meta callback)";
    await db.whatsAppMessage
      .updateMany({ where: { providerMessageId: s.id }, data: { status: "FAILED", errorMessage: reason } })
      .catch(() => {});
  }
}

async function handleInboundMessages(value: MetaChangeValue) {
  const messages = value.messages ?? [];
  if (messages.length === 0) return;

  const settings = await getCompanySettings().catch(() => null);
  const reviewUrl = settings?.googleReviewUrl || "";

  for (const m of messages) {
    if (!m.from) continue;

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
      }
      continue;
    }

    if (m.type !== "button" || !m.button?.text) continue;
    const from = m.from;
    const label = m.button.text;

    if (/before.*after|gallery|photo/i.test(label)) {
      await sendWhatsApp({
        kind: "OTHER",
        toNumber: from,
        body: `Here are our Before/After photos: ${GALLERY_PUBLIC_URL}`,
        relatedType: "WhatsAppWebhook",
        relatedId: m.id,
      });
      continue;
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
