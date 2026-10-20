import { db } from "@/lib/db";
import { notify } from "@/server/notify";
import { todayIST } from "@/lib/pricing-master";

// Daily warning for upcoming jobs that still have no crew. Runs from the reminders cron (once a day). It lists only job
// ids, dates and slots — no customer contact and no amounts — so Operations can see it. No schema: a recent
// OPS_TEAM_UNASSIGNED notification is the "already warned today" marker, so re-running the cron never spams.

export const TEAM_ALERT_HORIZON_DAYS = 3; // today + the next 3 days
const SKIP = ["COMPLETED", "CANCELLED", "POSTPONED"];

export type UnassignedJob = { jobNumber: string; date: string; slot: string; daysAway: number };

const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

/** Pure: which of these jobs need a crew warning on `today`. Sorted soonest first. */
export function unassignedWithin(
  jobs: { jobNumber: string; status: string; scheduledDate: Date; scheduledTime: string; crewCount: number }[],
  today: string,
  horizon = TEAM_ALERT_HORIZON_DAYS,
): UnassignedJob[] {
  const last = addDays(today, horizon);
  return jobs
    .filter((j) => !SKIP.includes(j.status) && j.crewCount === 0)
    .map((j) => ({ jobNumber: j.jobNumber, date: j.scheduledDate.toISOString().slice(0, 10), slot: j.scheduledTime }))
    .filter((j) => j.date >= today && j.date <= last)
    .map((j) => ({ ...j, daysAway: daysBetween(today, j.date) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.jobNumber.localeCompare(b.jobNumber));
}

export function alertText(list: UnassignedJob[]): { title: string; body: string } {
  const label = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);
  const shown = list.slice(0, 8).map((j) => `${j.jobNumber} ${label(j.daysAway)} ${j.slot}`);
  const more = list.length > shown.length ? ` +${list.length - shown.length} more` : "";
  return {
    title: list.length === 1 ? `1 upcoming job has no team assigned` : `${list.length} upcoming jobs have no team assigned`,
    body: `${shown.join(" · ")}${more}. Assign a team in Dispatch.`,
  };
}

export async function runUnassignedTeamAlert(now = new Date()) {
  const today = todayIST();
  const recent = await db.notification.findFirst({ where: { kind: "OPS_TEAM_UNASSIGNED", createdAt: { gt: new Date(now.getTime() - 12 * 3_600_000) } }, select: { id: true } });
  if (recent) return { sent: false as const, reason: "already warned in the last 12 hours", count: 0 };
  const rows = await db.job.findMany({
    where: { deletedAt: null, status: { notIn: SKIP as never }, scheduledDate: { gte: new Date(`${today}T00:00:00Z`), lte: new Date(`${addDays(today, TEAM_ALERT_HORIZON_DAYS)}T23:59:59Z`) } },
    select: { jobNumber: true, status: true, scheduledDate: true, scheduledTime: true, _count: { select: { assignments: true } } },
    take: 300,
  });
  const list = unassignedWithin(rows.map((r) => ({ ...r, crewCount: r._count.assignments })), today);
  if (!list.length) return { sent: false as const, reason: "every upcoming job has a team", count: 0 };
  const { title, body } = alertText(list);
  await notify({ kind: "OPS_TEAM_UNASSIGNED", title, body, href: "/jobs", tag: "ops-team-unassigned" });
  return { sent: true as const, count: list.length };
}
