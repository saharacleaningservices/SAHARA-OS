import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseCallClick } from "@/lib/call-click";
import { recordCallClick } from "@/server/call-click";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leads/call-click — beacon fired when a visitor taps a tel: link on the public site (owner 2026-11-13).
 * No login, so it is rate-limited per IP, body-capped, and accepts nothing but a tel: tap on a valid Indian number.
 * Always answers 204 for a well-formed tap (even if logging failed) so the page never sees an error; the call itself never waits on it.
 */
const MAX_BYTES = 6_000;

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`call-click:${ip}`, 20, 600);
  if (!rl.allowed) return new NextResponse(null, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const input = parseCallClick(body);
  if (!input) return new NextResponse(null, { status: 422 });

  try {
    await recordCallClick(input, { ip, ua: (req.headers.get("user-agent") ?? "").slice(0, 200) });
  } catch (e) {
    console.error("[call-click] failed:", e);
  }
  return new NextResponse(null, { status: 204 });
}
