import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { collectHealth } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health
//   Anyone (Coolify health check, uptime monitor): { status } with HTTP 200 (ok / degraded) or 503 (unhealthy).
//   Super Admin session, or header `x-health-token` matching HEALTH_TOKEN: the full report — database latency,
//   memory vs the container limit, CPU, event-loop lag. Nothing else is ever exposed publicly.
function tokenOk(request: NextRequest) {
  const want = process.env.HEALTH_TOKEN;
  const got = request.headers.get("x-health-token");
  if (!want || want.length < 16 || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`health:${clientIp(request.headers)}`, 120, 60).allowed) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }
  try {
    const report = await collectHealth();
    const code = report.status === "unhealthy" ? 503 : 200;
    const headers = { "Cache-Control": "no-store" };
    const detailed = tokenOk(request) || (await getSession().catch(() => null))?.role === "ADMIN";
    return NextResponse.json(detailed ? report : { status: report.status }, { status: code, headers });
  } catch {
    // Even the health check failing is a signal: report unhealthy rather than throwing a 500 page.
    return NextResponse.json({ status: "unhealthy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

// Health checks are often HEAD requests.
export async function HEAD(request: NextRequest) {
  const r = await GET(request);
  return new NextResponse(null, { status: r.status, headers: r.headers });
}
