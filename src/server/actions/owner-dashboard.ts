"use server";

import { requireRole } from "@/lib/current-user";
import { getLeadMonthCalendar, type CalendarDetailLevel } from "@/server/owner-command-center";

/**
 * Client-callable month navigation for the calendar widget, now shown to
 * every role (owner instruction 2026-09-21: "Calendar widget visible for
 * all roles"). The detail level is decided here, from the session's real
 * role, never trusted from the client:
 *  - ADMIN/ACCOUNTS: "full" (name, phone, area, address, payment, stage).
 *  - SUPERVISOR (Francis): "supervisor" (Job ID, name, service, area, team,
 *    status label — no phone/address/payment).
 *  - OPERATIONS (Shoyab): "counts" (day status-count breakdown only, no
 *    per-lead list at all).
 */
export async function fetchLeadMonthCalendar(year: number, month: number) {
  const session = await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"]);
  const detailLevel: CalendarDetailLevel =
    session.role === "ADMIN" || session.role === "ACCOUNTS" ? "full" : session.role === "SUPERVISOR" ? "supervisor" : "counts";
  return getLeadMonthCalendar(year, month, detailLevel);
}
