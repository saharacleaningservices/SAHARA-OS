import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getCompanySettings } from "@/server/settings";
import { GALLERY_PUBLIC_URL } from "@/lib/gallery";

// Meta WhatsApp Cloud API webhook — receives inbound customer messages and
// delivery-status callbacks for every message sendWhatsApp() sends (see
// src/lib/whatsapp.ts). Registering this URL + verify token in the Meta App
// dashboard (Configuration → Webhooks → WhatsApp → Manage) is a one-time
// setup step for whoever holds Meta Business Manager access — that account
// creation / dashboard step is explicitly out of scope for this build, same
// as the 5000+ customer bulk broadcast. This route only needs to exist and
// behave correctly so that step, whenever it happens, just works:
//
//   Callback URL:   https://app.saharacleaningservices.com/api/webhooks/whatsapp
//   Verify token:   whatever value is set as WHATSAPP_WEBHOOK_VERIFY_TOKEN
//                   in the Coolify environment (Settings → Environment
//                   Variables on the app) — pick any long random string and
//                   paste the same value into the Meta dashboard field.
//   Subscribe to:   messages (for the Quick Reply button auto-replies below)

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
type MetaInboundMessage = { id?: string; from?: string; type?: string; button?: { text?: string; payload?: string } };
type MetaChangeValue = { messages?: MetaInboundMessage[]; statuses?: MetaStatus[] };
type MetaChange = { value?: MetaChangeValue };
type MetaEntry = { changes?: MetaChange[] };
type MetaWebhookPayload = { entry?: MetaEntry[] };

/**
 * POST — two things land here:
 *
 * 1. Quick Reply button taps on the booking-confirmation template ("Before /
 *    After Photos" and "Give Google Review" — see
 *    BOOKING_CONFIRMATION_META_TEMPLATE in whatsapp-templates.ts) arrive as
 *    inbound type:"button" messages. A Quick Reply button carries no URL of
 *    its own, so we auto-reply with the real link the button promised.
 * 2. Delivery-status callbacks (sent/delivered/read/failed) are matched to
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
  let payload: MetaWebhookPayload | null = null;
  try {
    payload = (await req.json()) as MetaWebhookPayload;
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
    if (m.type !== "button" || !m.from || !m.button?.text) continue;
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
