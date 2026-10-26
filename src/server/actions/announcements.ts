"use server";

// Announcements — published from the CRM (/admin/announcements), shown in the
// Staff App. Only IMPORTANT announcements push a notification (one per staff
// login); normal ones just appear in the app. Archiving is always silent.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { notifyAllStaffUsers, notifyStaff } from "@/server/staff-notify";

function canPublish(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS";
}

const schema = z.object({
  title: z.string().trim().min(3, "Add a short title").max(120),
  body: z.string().trim().min(3, "Write the announcement").max(2000),
  important: z.boolean().optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  // Recipients: everyone, chosen staff, or crew team(s) 1–4.
  audience: z.enum(["ALL", "STAFF", "TEAM"]).default("ALL"),
  staffIds: z.array(z.string().min(1)).max(500).optional(),
  teamNumbers: z.array(z.number().int().min(1).max(4)).max(4).optional(),
});

/**
 * Team → staff, resolved ONCE at publish time: everyone assigned to a job of
 * that team today (or, if the team has no job today, its most recent job day
 * in the last 14 days). Stored as staffIds so later crew changes don't move it.
 */
async function staffOfTeams(teams: number[]): Promise<string[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - 14);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  const ids = new Set<string>();
  for (const team of teams) {
    const jobs = await db.job.findMany({
      where: { teamNumber: team, deletedAt: null, scheduledDate: { gte: from, lt: end } },
      orderBy: { scheduledDate: "desc" },
      select: { scheduledDate: true, assignments: { select: { staffId: true } } },
    });
    const day = jobs[0]?.scheduledDate.toDateString();
    for (const j of jobs) if (j.scheduledDate.toDateString() === day) j.assignments.forEach((a) => ids.add(a.staffId));
  }
  return [...ids];
}

export async function listStaffForAnnouncements() {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return [];
  return db.staff.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, employeeCode: true } });
}

export async function listAnnouncementsForAdmin() {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return [];
  return db.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 100 });
}

export async function publishAnnouncement(values: unknown) {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return { error: "Not authorized" };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { title, body, important, expiresOn, audience } = parsed.data;
  const teamNumbers = audience === "TEAM" ? [...new Set(parsed.data.teamNumbers ?? [])] : [];
  const recipients = audience === "STAFF" ? [...new Set(parsed.data.staffIds ?? [])] : audience === "TEAM" ? await staffOfTeams(teamNumbers) : [];
  if (audience !== "ALL" && recipients.length === 0)
    return { error: audience === "TEAM" ? "No staff found on that team's recent jobs" : "Choose at least one staff member" };

  let expiresAt: Date | null = null;
  if (expiresOn) {
    const [y, m, d] = expiresOn.split("-").map(Number);
    expiresAt = new Date(y, m - 1, d, 23, 59, 59);
  }

  const row = await db.announcement.create({
    data: {
      title,
      body,
      important: Boolean(important),
      expiresAt,
      createdByName: session.name,
      audience,
      staffIds: audience === "ALL" ? null : JSON.stringify(recipients),
      teamNumbers: teamNumbers.length ? JSON.stringify(teamNumbers) : null,
    },
  });
  const push = {
    kind: "ANNOUNCEMENT" as const,
    title: important ? `Important: ${title}` : title,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    href: `/my/announcements#a-${row.id}`,
    recordId: row.id,
    important: Boolean(important),
  };
  // Every office announcement alerts its recipients (in-app + push with sound/vibration);
  // Important ones are marked critical (stay on screen, stronger vibration).
  let sentTo = 0;
  if (audience === "ALL") sentTo = await notifyAllStaffUsers(push);
  else {
    await notifyStaff(recipients, push);
    sentTo = recipients.length;
  }
  revalidatePath("/admin/announcements");
  revalidatePath("/my", "layout");
  return { success: true as const, sentTo };
}

export async function setAnnouncementActive(id: string, isActive: boolean) {
  const session = await getSession();
  if (!session || !canPublish(session.role)) return { error: "Not authorized" };
  await db.announcement.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/announcements");
  revalidatePath("/my", "layout");
  return { success: true as const };
}
