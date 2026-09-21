import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runAllReminderSweeps } from "@/server/reminders";
import { sendDailyAttendanceSummary } from "@/server/attendance";
import { sendDailyBusinessSummary } from "@/server/daily-summary";
import { flushWhatsAppQueue } from "@/lib/whatsapp";
import { flushSmsQueue } from "@/lib/sms";

// Runs the WhatsApp reminder sweeps: customer job reminders (tomorrow's
// jobs), payment reminders (due-soon/overdue balances), AMC renewal
// reminders (visit due within 3 days), and the daily attendance + business
// summaries to the admin number(s). Intended to be hit once a day by a scheduled job
// (see .github/workflows/reminders.yml, same pattern as backup.yml).
//
// Auth: Authorization: Bearer <CRON_TOKEN> (automation) OR a logged-in Admin
// session cookie (manual "Run Now" from the app). Allow-listed in
// src/middleware.ts like /api/backup.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = process.env.CRON_TOKEN;
  const provided = request.headers.get("authorization") ?? "";
  const isTokenAuth = Boolean(token) && provided === `Bearer ${token}`;

  const session = isTokenAuth ? null : await getSession();
  const isAdminAuth = session?.role === "ADMIN";

  if (!isTokenAuth && !isAdminAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reminders = await runAllReminderSweeps();
  const attendance = await sendDailyAttendanceSummary();
  const dailySummary = await sendDailyBusinessSummary();
  const [whatsappFlush, smsFlush] = await Promise.all([
    flushWhatsAppQueue({ includeFailed: true }).catch(() => null),
    flushSmsQueue({ includeFailed: true }).catch(() => null),
  ]);

  return NextResponse.json({ reminders, attendance, dailySummary, whatsappFlush, smsFlush });
}
