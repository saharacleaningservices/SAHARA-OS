import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runOpsReminderSweep } from "@/server/ops-reminders";

// Ops reminder sweep (job closure / payment collection / escalation / daily
// summary). Normally runs every minute in-process (src/instrumentation.ts);
// this endpoint lets an external scheduler drive it too — safe to call as often
// as you like (rows are claimed atomically, nothing is sent twice).
// Auth: Authorization: Bearer <CRON_TOKEN> or a logged-in Admin session.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = process.env.CRON_TOKEN;
  const isTokenAuth = Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
  if (!isTokenAuth && (await getSession())?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runOpsReminderSweep());
}
