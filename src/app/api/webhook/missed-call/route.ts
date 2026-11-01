import { NextRequest, NextResponse } from "next/server";
import { last10 } from "@/lib/phone";
import { safeEqual } from "@/lib/safe-equal";
import { recordCallLead } from "@/server/call-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Missed-call → auto-lead. Point a telephony provider's missed-call webhook
 * (Exotel / Knowlarity / MyOperator / Servetel …) at this URL.
 *
 * Auth: Authorization: Bearer <MISSED_CALL_TOKEN> (falls back to CRON_TOKEN).
 * Accepts the caller number from common field names via GET query or JSON/form
 * POST: caller | from | CallFrom | mobile | number.
 */
function extractNumber(obj: Record<string, unknown>): string | null {
  for (const k of ["caller", "from", "CallFrom", "callfrom", "mobile", "number", "msisdn"]) {
    const v = obj[k];
    if (typeof v === "string" && v.replace(/\D/g, "").length >= 10) return v;
  }
  return null;
}

async function handle(req: NextRequest, raw: Record<string, unknown>) {
  // Fail CLOSED, not open: if neither token env var is configured, this
  // endpoint used to skip the check entirely (the `token &&` guard made the
  // whole condition false, so `if` never fired) — meaning anyone could POST
  // an arbitrary phone number and create real leads, or attach a fake
  // "missed call" timeline entry to an existing customer's lead. Found in
  // the 2026-09-21 security audit; fixed to always require a match against
  // a configured token, never silently accept when unconfigured.
  const token = process.env.MISSED_CALL_TOKEN || process.env.CRON_TOKEN;
  const provided = req.headers.get("authorization") ?? "";
  const qToken = req.nextUrl.searchParams.get("token") ?? "";
  if (!token || (!safeEqual(provided, `Bearer ${token}`) && !safeEqual(qToken, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const number = extractNumber(raw);
  const mobile = last10(number);
  if (mobile.length !== 10) return NextResponse.json({ error: "No valid caller number" }, { status: 400 });

  // Match an open / recent lead or auto-create one (shared with /api/v1/webhooks/call-trigger).
  const r = await recordCallLead(mobile, "MISSED");
  return NextResponse.json(r.created ? { ok: true, created: r.leadNumber } : { ok: true, matchedExisting: r.leadNumber });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) body = await req.json();
    else {
      const fd = await req.formData();
      body = Object.fromEntries([...fd.entries()]);
    }
  } catch {
    body = {};
  }
  const merged = { ...Object.fromEntries(req.nextUrl.searchParams.entries()), ...body };
  return handle(req, merged);
}

export async function GET(req: NextRequest) {
  return handle(req, Object.fromEntries(req.nextUrl.searchParams.entries()));
}
