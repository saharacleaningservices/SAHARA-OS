import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ingestEnquiry } from "@/server/enquiry-intake";
import { safeEqual } from "@/lib/safe-equal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email / Cognito Forms lead intake. A Google Apps Script on the contact@ mailbox posts one JSON
 * payload per new enquiry: { name, mobile, service, location, email, message, source }.
 *
 * Auth: Authorization: Bearer <EMAIL_LEAD_TOKEN> (falls back to CRON_TOKEN) — fails closed.
 * Alerts: in-app/push via notify() (Operations sees the masked version), plus a WhatsApp copy to the
 * Admin (notify) and to the Accounts user (Shoyab). Operations (Francis) gets NO WhatsApp lead alert.
 * WhatsApp sends go through sendWhatsApp(), so TEST MODE / opt-out rules still apply.
 * The intake itself (dedupe, lead, follow-up, alerts) lives in src/server/enquiry-intake.ts, shared with the Cognito webhook.
 */

/** Max clock difference accepted for a signed request — limits replay of a captured request. */
const SIGNATURE_MAX_AGE_SECONDS = 300;

/**
 * Optional HMAC-SHA256 request signing. When EMAIL_LEAD_HMAC_SECRET is set (Coolify, and the same value as
 * HMAC_SECRET in the Apps Script properties), every request must carry
 *   X-Sahara-Timestamp: <unix seconds>   and   X-Sahara-Signature: sha256=<hex HMAC of "<timestamp>.<raw body>">
 * within ±5 minutes. Unset = Bearer token only (unchanged behaviour), so the live script keeps working until
 * the owner adds the secret on both sides.
 */
function signatureOk(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.EMAIL_LEAD_HMAC_SECRET;
  if (!secret) return true;
  const ts = req.headers.get("x-sahara-timestamp") ?? "";
  const sig = req.headers.get("x-sahara-signature") ?? "";
  if (!/^\d{9,11}$/.test(ts)) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > SIGNATURE_MAX_AGE_SECONDS) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return safeEqual(sig, expected);
}

export async function POST(req: NextRequest) {
  const token = process.env.EMAIL_LEAD_TOKEN || process.env.CRON_TOKEN;
  const provided = req.headers.get("authorization") ?? "";
  if (!token || !safeEqual(provided, `Bearer ${token}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the body once as text: the signature covers these exact bytes.
  const rawBody = await req.text();
  if (!signatureOk(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    raw = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await ingestEnquiry(raw);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
