import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { shortLinkTarget } from "@/server/short-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short customer link /p/{code} (owner 2026-10-24) — redirects to the real page; an unknown code is a plain 404. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit(`short:${clientIp(request.headers)}`, 60, 600).allowed) return new NextResponse("Too many requests", { status: 429 });
  const target = await shortLinkTarget("p", code);
  if (!target) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(new URL(target, PUBLIC_BOOKING_URL), 302);
}
