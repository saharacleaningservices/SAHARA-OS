import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/safe-equal";

// Shared bearer-token check for the telephony webhooks (/api/v1/webhooks/call-trigger and /call-recording): the IVR provider and the
export function callWebhookAuthorised(req: NextRequest): boolean {
  const token = process.env.CALL_TRIGGER_TOKEN || process.env.MISSED_CALL_TOKEN || process.env.CRON_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const q = req.nextUrl.searchParams.get("token") ?? "";
  return safeEqual(header, `Bearer ${token}`) || safeEqual(q, token);
}
