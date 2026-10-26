// Staff App notifications — delivered to the specific staff member(s) an
// event is about, never role-broadcast like src/server/notify.ts. Each event
// writes exactly one Notification row per recipient and one push whose tag is
// unique to the record ("STAFF_ADVANCE:<id>"), so one event = one
// notification and a later event never silently replaces an earlier one.
// Tapping opens `href` — always the exact record inside /my.
//
// Callers only invoke this after a real change (new advance, attendance
// status actually changed, crew actually changed…) — unchanged saves stay
// silent. Never throws: delivery must not break the office action.

import { db } from "@/lib/db";
import { pushToUsers } from "@/lib/webpush";

export type StaffNotifKind =
  | "STAFF_ATTENDANCE"
  | "STAFF_ADVANCE"
  | "STAFF_FINE"
  | "STAFF_REWARD"
  | "STAFF_JOB_ASSIGNED"
  | "STAFF_JOB_CHANGED"
  | "STAFF_PAYMENT"
  | "STAFF_LOAN"
  | "STAFF_OVERTIME"
  | "ANNOUNCEMENT";

export type StaffNotifyInput = {
  kind: StaffNotifKind;
  title: string;
  body?: string;
  href: string;
  /** record id — makes the push tag unique per event */
  recordId: string;
  important?: boolean;
};

/** Staff ids → their active Staff-App user ids (staff without a login are skipped). */
async function userIdsForStaff(staffIds: string[]): Promise<string[]> {
  if (staffIds.length === 0) return [];
  const rows = await db.staff.findMany({
    // STAFF-role logins only: hrefs point into /my, which other roles can't open.
    where: { id: { in: [...new Set(staffIds)] }, deletedAt: null, userId: { not: null }, user: { isActive: true, role: "STAFF" } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId!).filter(Boolean);
}

async function deliver(userIds: string[], input: StaffNotifyInput) {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href,
      critical: Boolean(input.important),
      meta: JSON.stringify({ recordId: input.recordId }),
    })),
  });
  // Device push runs in the background — the in-app row above is already saved.
  void pushToUsers(userIds, {
    title: input.title,
    body: input.body,
    href: input.href,
    critical: Boolean(input.important),
    tag: `${input.kind}:${input.recordId}`,
    staffApp: true,
  }).catch(() => {});
}

export async function notifyStaff(staffIds: string[], input: StaffNotifyInput): Promise<void> {
  try {
    await deliver(await userIdsForStaff(staffIds), input);
  } catch {
    // swallow — see header comment
  }
}

/** Announcement fan-out to every active Staff-App login. */
export async function notifyAllStaffUsers(input: StaffNotifyInput): Promise<number> {
  try {
    const users = await db.user.findMany({
      where: { isActive: true, role: "STAFF", staffProfile: { is: { deletedAt: null } } },
      select: { id: true },
    });
    await deliver(users.map((u) => u.id), input);
    return users.length;
  } catch {
    return 0;
  }
}

/** "YYYY-MM-DD" for a stored day (local-midnight convention, see attendance.ts). */
export function isoDay(d: Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function dayHref(d: Date, anchor?: string): string {
  return `/my/day/${isoDay(d)}${anchor ? `#${anchor}` : ""}`;
}
