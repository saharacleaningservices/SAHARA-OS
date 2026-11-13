"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageTracking, gpsSubjectOf, validateFix } from "@/lib/field-ops";
import { getCompanySettings } from "@/server/settings";
import { getOwnStaffId } from "@/server/jobs";

// Live GPS tracking (owner brief 2026-11-13). The log table is append-only (DB triggers refuse UPDATE / DELETE), and there is no
// action anywhere that edits or removes a ping. Only the Super Admin can flip the tracking switch.

const MIN_PING_GAP_MS = 2 * 60_000;
const PING_ROLES = ["STAFF", "SUPERVISOR", "OPERATIONS", "ACCOUNTS"];

/** Active-shift location ping from the person's own phone (field technicians and supervisors alike). Only while they hold a live job. */
export async function recordLocationPing(jobId: string, rawFix: unknown) {
  const session = await getSession();
  if (!session || !PING_ROLES.includes(session.role)) return { error: "Not authorized", success: false as const };
  const settings = await getCompanySettings();
  if (!settings.gpsTrackingEnabled) return { success: true as const, skipped: "off" as const };
  const staffId = await getOwnStaffId(session.sub);
  if (!staffId) return { success: true as const, skipped: "no-profile" as const };
  const live = await db.job.findFirst({
    where: { id: jobId, deletedAt: null, status: { in: ["ON_THE_WAY", "STARTED"] }, assignments: { some: { staffId } } },
    select: { id: true },
  });
  if (!live) return { success: true as const, skipped: "no-active-job" as const };
  const v = validateFix(rawFix);
  if (!v.ok) return { error: v.error, success: false as const };
  const last = await db.locationPing.findFirst({ where: { staffId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < MIN_PING_GAP_MS) return { success: true as const, skipped: "too-soon" as const };
  const st = await db.staff.findUnique({ where: { id: staffId }, select: { name: true, designation: true, user: { select: { role: true } } } });
  await db.locationPing.create({
    data: { staffId, staffName: st?.name ?? session.name, jobId, kind: "PING", lat: v.fix.lat, lng: v.fix.lng, accuracyM: v.fix.acc, subjectType: gpsSubjectOf({ designation: st?.designation, userRole: st?.user?.role }) },
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
