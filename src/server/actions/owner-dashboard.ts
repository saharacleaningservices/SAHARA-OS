"use server";

import { requireRole } from "@/lib/current-user";
import { getLeadMonthCalendar } from "@/server/owner-command-center";

/**
 * Client-callable month navigation for the Owner Command Center's Smart
 * Monthly Calendar (Total Leads hero card). ADMIN-only, matching the rest of
 * this dashboard.
 */
export async function fetchLeadMonthCalendar(year: number, month: number) {
  await requireRole(["ADMIN"]);
  return getLeadMonthCalendar(year, month);
}
