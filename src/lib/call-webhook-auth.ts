import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Shared bearer-token check for the telephony webhooks (/api/v1/webhooks/call-trigger and /call-recording): the IVR provider and the
// Sahara OS Helper app both send "Authorization: Bearer <token>" (or ?token=). Fails closed when no token is configured.
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function callWebhookAuthorised(req: NextRequest): boolean {
  const token = process.env.CALL_TRIGGER_TOKEN || process.env.MISSED_CALL_TOKEN || process.env.CRON_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const q = req.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(header, `Bearer ${token}`) || safeEqual(q, token);
}
