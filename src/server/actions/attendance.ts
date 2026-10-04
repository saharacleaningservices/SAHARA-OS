"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSMS } from "@/lib/sms";
import { staffAttendanceMessage } from "@/lib/whatsapp-templates";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { notifyStaff, dayHref } from "@/server/staff-notify";
import {
  checkIn,
  checkOut,
  setAttendanceForDate,
  bulkSetAttendance,
  officeCheckIn as officeCheckInSrv,
  officeCheckOut as officeCheckOutSrv,
  closeMonth as closeMonthSrv,
  reopenMonth as reopenMonthSrv,
  getStaffLedger,
  type AttendanceCode,
} from "@/server/attendance";

const CODES: AttendanceCode[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "WEEKLY_OFF"];

async function ownStaffId(userId: string) {
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } });
  return staff?.id ?? null;
}

/**
 * Altaf (ADMIN) / Shoaib (ACCOUNTS) / Francis (OPERATIONS) all operate the
 * office attendance clock — ROLE_NAV_ACCESS gives all three "attendance"
 * (per the owner's 2026-09-21 decision for Francis). SUPERVISOR (Field
 * Coordinator) needs it for their own self check-in.
 */
function canOperateAttendance(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}
/**
 * Editing the calendar / backfill / bulk / month-close stays an Admin +
 * Accounts capability (per canManageAttendance in src/lib/permissions.ts,
 * which gates every edit control on the Attendance page) — Francis gets
 * view + the office clock (above), not calendar correction. OPERATIONS is
 * kept in this allow-list for backward compatibility, but has no UI path to
 * reach these actions: the page never renders their buttons/dropdowns for
 * him, only for canManage roles.
 */
function canEditCalendar(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS";
}

/**
 * Fire the staff WhatsApp notification workflow. The message is always queued
 * (WhatsAppMessage row); it goes out for real the moment the Cloud API creds
 * are saved in Settings — no code change needed (Phase 6).
 */
async function notifyStaffAttendance(staffId: string, status: string, when: Date) {
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff?.mobile) return;
  const now = new Date();
  const ledger = await getStaffLedger(staffId, now.getFullYear(), now.getMonth() + 1);
  const body = staffAttendanceMessage({
    name: staff.name,
    date: when,
    status,
    workingDays: ledger.presentDays,
    advance: ledger.advanceTotal,
    runningSalary: ledger.runningSalary,
    balance: ledger.finalSalary,
  });
  // KhataBook-style — WhatsApp first, SMS as the fallback. Both queue and
  // flush automatically once their gateway credentials are saved.
  await sendWhatsApp({ kind: "ATTENDANCE_SUMMARY", toNumber: staff.mobile, toName: staff.name, body, relatedType: "Staff", relatedId: staffId }).catch(() => {});
  await sendSMS({ kind: "ATTENDANCE", toNumber: staff.mobile, toName: staff.name, body, relatedType: "Staff", relatedId: staffId }).catch(() => {});
}

/** Staff App push — one per real change (a bulk range is one notification, not one per day). */
async function pushStaffAttendance(staffId: string, status: string, from: Date, to?: Date) {
  const label = ATTENDANCE_STATUS_LABELS[status] ?? status;
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  await notifyStaff([staffId], {
    kind: "STAFF_ATTENDANCE",
    title: `Attendance: ${label}`,
    body: to && to.getTime() !== from.getTime() ? `${fmt(from)} – ${fmt(to)} marked ${label}` : `${fmt(from)} marked ${label}`,
    href: dayHref(from, "attendance"),
    recordId: `${staffId}:${from.getTime()}:${to?.getTime() ?? ""}:${status}:${Date.now()}`,
  });
}

function bump() {
  revalidatePath("/attendance");
  revalidatePath("/staff", "layout");
  revalidatePath("/dashboard");
}

// ── Staff self check-in/out (kept for future GPS/QR; not surfaced in UI) ──
export async function selfCheckIn(gpsLat?: number | null, gpsLng?: number | null) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const staffId = await ownStaffId(session.sub);
  if (!staffId) return { error: "No staff profile linked to this login" };
  await checkIn(staffId, gpsLat, gpsLng);
  bump();
  return { success: true as const };
}

export async function selfCheckOut() {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const staffId = await ownStaffId(session.sub);
  if (!staffId) return { error: "No staff profile linked to this login" };
  await checkOut(staffId);
  bump();
  return { success: true as const };
}

// ── Monthly calendar editing ────────────────────────────────────────────
export async function markAttendanceDay(staffId: string, dateIso: string, status: AttendanceCode) {
  const session = await getSession();
  if (!session || !canEditCalendar(session.role)) return { error: "Not authorized" };
  if (!CODES.includes(status)) return { error: "Invalid status" };
  const res = await setAttendanceForDate({ staffId, date: dateIso, status, actorName: session.name });
  if ("error" in res) return { error: res.error };
  if (!("unchanged" in res)) {
    await notifyStaffAttendance(staffId, status, new Date(dateIso));
    const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number);
    await pushStaffAttendance(staffId, status, new Date(y, m - 1, d));
  }
  bump();
  return { success: true as const };
}

export async function bulkMarkAttendance(staffId: string, from: string, to: string, status: AttendanceCode) {
  const session = await getSession();
  if (!session || !canEditCalendar(session.role)) return { error: "Not authorized" };
  if (!CODES.includes(status)) return { error: "Invalid status" };
  const res = await bulkSetAttendance({ staffId, from, to, status, actorName: session.name });
  if ("error" in res) return { error: res.error };
  await notifyStaffAttendance(staffId, status, new Date(to));
  if (res.applied > 0) {
    const day = (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    await pushStaffAttendance(staffId, status, day(from), day(to));
  }
  bump();
  return { success: true as const, applied: res.applied, skipped: res.skipped };
}

// ── Office attendance clock (today) ─────────────────────────────────────
export async function officeCheckIn(staffId: string) {
  const session = await getSession();
  if (!session || !canOperateAttendance(session.role)) return { error: "Not authorized" };
  const res = await officeCheckInSrv(staffId, session.name);
  if ("error" in res) return { error: res.error };
  if (!("alreadyIn" in res)) {
    await notifyStaffAttendance(staffId, "PRESENT", new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await pushStaffAttendance(staffId, "PRESENT", today);
  }
  bump();
  return { success: true as const };
}

export async function officeCheckOut(staffId: string) {
  const session = await getSession();
  if (!session || !canOperateAttendance(session.role)) return { error: "Not authorized" };
  const res = await officeCheckOutSrv(staffId, session.name);
  if ("error" in res) return { error: res.error };
  bump();
  return { success: true as const };
}

// ── Month closing ──────────────────────────────────────────────────────
export async function closeAttendanceMonth(year: number, month: number) {
  const session = await getSession();
  if (!session || !canEditCalendar(session.role)) return { error: "Not authorized" };
  const res = await closeMonthSrv(year, month, session.name);
  if ("error" in res) return { error: res.error };
  bump();
  return { success: true as const };
}

export async function reopenAttendanceMonth(year: number, month: number) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only the Super Admin can reopen a closed month" };
  const res = await reopenMonthSrv(year, month, session.name);
  if ("error" in res) return { error: res.error };
  bump();
  return { success: true as const };
}

/** Legacy single-button "mark today" — retained for the Today · All Staff list. */
export async function markAttendance(staffId: string, status: AttendanceCode) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return markAttendanceDay(staffId, today.toISOString().slice(0, 10), status);
}
