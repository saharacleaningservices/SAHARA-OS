"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageTracking, gpsSubjectOf, isOnShift, LIVE_JOB_STATUSES, MIN_PING_GAP_MS, resolvePingTarget, validateFix } from "@/lib/field-ops";
import { istDayRange } from "@/lib/ist-days";
import { getCompanySettings } from "@/server/settings";
import { getOwnStaffId } from "@/server/jobs";

// Live GPS tracking (owner brief 2026-11-13). The log table is append-only (DB triggers refuse UPDATE / DELETE), and there is no
// action anywhere that edits or removes a ping. Only the Super Admin can flip the tracking switch.

const PING_ROLES = ["STAFF", "SUPERVISOR", "OPERATIONS", "ACCOUNTS"];

const OFFICE_PING_ROLES = ["OPERATIONS", "ACCOUNTS", "SUPERVISOR"];

/** The caller's own live job (On the way / Reached / In progress) and whether they are checked in for today's shift. */
async function ownActivity(staffId: string, requestedJobId: string | null) {
  const { from } = istDayRange(new Date());
  const [requested, own, shift] = await Promise.all([
    requestedJobId
      ? db.job.findFirst({ where: { id: requestedJobId, deletedAt: null, status: { in: [...LIVE_JOB_STATUSES] }, assignments: { some: { staffId } } }, select: { id: true } })
      : null,
    db.job.findFirst({ where: { deletedAt: null, status: { in: [...LIVE_JOB_STATUSES] }, assignments: { some: { staffId } } }, orderBy: { onTheWayAt: "desc" }, select: { id: true } }),
    db.attendance.findFirst({ where: { staffId, checkInTime: { gte: from } }, orderBy: { checkInTime: "desc" }, select: { checkInTime: true, checkOutTime: true } }),
  ]);
  return { requestedJobLive: !!requested, ownLiveJobId: own?.id ?? null, onShift: isOnShift(shift, from) };
}

/**
 * Cheap check the pinger makes before it wakes the GPS: is tracking on and is this person on an active job / shift right now?
 * Returns no coordinates and nothing about anyone else.
 */
export async function getLocationPingStatus(): Promise<{ active: boolean }> {
  const session = await getSession();
  if (!session || !PING_ROLES.includes(session.role)) return { active: false };
  const settings = await getCompanySettings();
  if (!settings.gpsTrackingEnabled) return { active: false };
  if (OFFICE_PING_ROLES.includes(session.role)) return { active: true };
  const staffId = await getOwnStaffId(session.sub);
  if (!staffId) return { active: false };
  const a = await ownActivity(staffId, null);
  return { active: resolvePingTarget({ office: false, requestedJobId: null, ...a }).ok };
}

/**
 * Active-shift location ping from the person's own phone or browser, every few minutes for the whole shift. Field technicians ping
 * while they hold a live job — On the way, after Reached Location and while In progress, until the job is Completed — or while
 * checked in for the day's shift (jobId null: the server finds their live job itself). Francis / Shoaib (office supervisor roles) ping
 * from ANY open CRM page (jobId null), logged as SUPERVISOR subjects, so the Super Admin always sees their location.
 * Nothing here ever returns coordinates to the caller.
 */
export async function recordLocationPing(jobId: string | null, rawFix: unknown) {
  const session = await getSession();
  if (!session || !PING_ROLES.includes(session.role)) return { error: "Not authorized", success: false as const };
  const office = OFFICE_PING_ROLES.includes(session.role);
  const settings = await getCompanySettings();
  if (!settings.gpsTrackingEnabled) return { success: true as const, skipped: "off" as const };
  const ownStaffId = await getOwnStaffId(session.sub);
  // An office login without a Staff profile is still logged, keyed by its user id, so nobody drops out of the log.
  const staffId = ownStaffId ?? (office ? `user:${session.sub}` : null);
  if (!staffId) return { success: true as const, skipped: "no-profile" as const };
  const activity = ownStaffId ? await ownActivity(ownStaffId, jobId) : { requestedJobLive: false, ownLiveJobId: null, onShift: false };
  const target = resolvePingTarget({ office, requestedJobId: jobId, ...activity });
  if (!target.ok) return { success: true as const, skipped: target.reason };
  const v = validateFix(rawFix);
  if (!v.ok) return { error: v.error, success: false as const };
  const last = await db.locationPing.findFirst({ where: { staffId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < MIN_PING_GAP_MS) return { success: true as const, skipped: "too-soon" as const };
  const st = ownStaffId ? await db.staff.findUnique({ where: { id: ownStaffId }, select: { name: true, designation: true, user: { select: { role: true } } } }) : null;
  const subjectType = office ? "SUPERVISOR" : gpsSubjectOf({ designation: st?.designation, userRole: st?.user?.role });
  await db.locationPing.create({
    data: { staffId, staffName: st?.name ?? session.name, jobId: target.jobId, kind: "PING", lat: v.fix.lat, lng: v.fix.lng, accuracyM: v.fix.acc, subjectType },
  });
  return { success: true as const };
}

/** Super Admin only: turn live tracking on or off. Refused server-side for every other role (Francis / Shoaib included). */
export async function setGpsTracking(enabled: boolean) {
  const session = await getSession();
  if (!session || !canManageTracking(session.role)) return { error: "Only the Super Admin can change tracking settings.", success: false as const };
  const settings = await getCompanySettings();
  await db.companySettings.update({ where: { id: settings.id }, data: { gpsTrackingEnabled: Boolean(enabled) } });
  await db.auditLog
    .create({ data: { entityType: "CompanySettings", entityId: settings.id, action: "GPS_TRACKING_TOGGLED", summary: `${session.name} turned live GPS tracking ${enabled ? "ON" : "OFF"}`, actorName: session.name, actorEmail: session.email ?? null } })
    .catch(() => {});
  revalidatePath("/field-ops/tracking");
  revalidatePath("/field-ops");
  return { success: true as const, enabled: Boolean(enabled) };
}
