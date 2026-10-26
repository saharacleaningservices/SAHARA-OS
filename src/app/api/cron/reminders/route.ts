import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runAllReminderSweeps } from "@/server/reminders";
import { sendDailyAttendanceSummary } from "@/server/attendance";
import { sendDailyBusinessSummary } from "@/server/daily-summary";
import { sendMonthlyBusinessSummary } from "@/server/monthly-summary";
import { flushWhatsAppQueue } from "@/lib/whatsapp";
import { flushSmsQueue } from "@/lib/sms";
import { flushEmailQueue } from "@/lib/email";
import { runRebookingReminders } from "@/server/rebooking";
import { runUnassignedTeamAlert } from "@/server/team-alerts";

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
  const teamAlert = await runUnassignedTeamAlert().catch(() => null); // upcoming jobs with no crew
  const rebooking = await runRebookingReminders().catch(() => null); // 3/6-month re-booking reminders (off unless REBOOKING_REMINDERS=on)

  // Monthly report fires automatically on the 1st (summarizing the month
  // that just closed); ?monthly=1 forces it on demand for a manual admin
  // "Run Now" or a one-off test, same idea as the CRON_TOKEN/session dual
  // auth above. ?month=YYYY-MM re-pulls a specific past month instead of
  // defaulting to "last month".
  const forceMonthly = request.nextUrl.searchParams.get("monthly") === "1";
  const monthParam = request.nextUrl.searchParams.get("month");
  const targetMonth = monthParam ? new Date(`${monthParam}-01T00:00:00`) : undefined;
  const monthlySummary =
    new Date().getDate() === 1 || forceMonthly ? await sendMonthlyBusinessSummary(targetMonth) : null;

  const [whatsappFlush, smsFlush, emailFlush] = await Promise.all([
    flushWhatsAppQueue({ includeFailed: true }).catch(() => null),
    flushSmsQueue({ includeFailed: true }).catch(() => null),
    flushEmailQueue({ includeFailed: true }).catch(() => null),
  ]);

  return NextResponse.json({ reminders, attendance, dailySummary, rebooking, teamAlert, monthlySummary, whatsappFlush, smsFlush, emailFlush });
}
