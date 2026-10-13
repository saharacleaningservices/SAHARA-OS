"use server";

// Staff App "Forgot PIN" (owner rule 2026-10-04): the staff member enters
// their registered mobile number (their login) + the new PIN they want; it
// takes effect only after Super Admin or Accounts approves it in the CRM
// (Staff → staff record → Staff App access). Reuses the SecurityOtp table
// (purpose STAFF_PIN_RESET; payload = pending bcrypt hash; codePlain records
// the decision) — no new table, no SMS/WhatsApp cost. The public request
// never reveals whether the mobile number matched an account.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, revokeUserSessions } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { staffPinSchema } from "@/lib/validation";
import { notify } from "@/server/notify";

const PURPOSE = "STAFF_PIN_RESET";
const TTL_HOURS = 48;

const requestSchema = z
  .object({
    mobile: z.string().trim().min(10, "Enter your 10-digit mobile number").max(15),
    // Optional extra check: employee code (SCS-001). If given it must match the mobile's staff record.
    employeeCode: z.string().trim().max(20).optional(),
    newPin: staffPinSchema,
    confirmPin: z.string().min(1, "Enter the new PIN again"),
  })
  .refine((v) => v.newPin === v.confirmPin, { message: "PINs do not match", path: ["confirmPin"] });

export async function requestStaffPinReset(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffreset:ip:${ip}`, 5, 600).allowed) return { error: "Too many requests. Try again in a few minutes." };

  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { mobile, newPin } = parsed.data;
  const digits = mobile.replace(/\D/g, "").slice(-10);
  const generic = { success: true as const, message: "Your request has been sent to the office. They will approve it soon." };
  if (digits.length !== 10) return { error: "Enter your 10-digit mobile number" };
  if (!rateLimit(`staffreset:acct:${digits}`, 3, 3600).allowed) return generic;

  // Same identity the login uses: the User's mobile number.
  const user = await db.user.findFirst({
    where: { phone: digits, role: "STAFF", isActive: true },
    select: { id: true, email: true, staffProfile: { select: { id: true, name: true, employeeCode: true, deletedAt: true, isActive: true } } },
  });
  const staff = user?.staffProfile && !user.staffProfile.deletedAt && user.staffProfile.isActive ? { ...user.staffProfile, user } : null;
  if (!staff) return generic;
  const code = parsed.data.employeeCode?.toUpperCase().replace(/\s+/g, "");
  if (code && code !== staff.employeeCode.toUpperCase()) return generic;

  // One open request per staff member — a newer request supersedes the older one.
  await db.securityOtp.updateMany({
    where: { purpose: PURPOSE, targetUserId: staff.user.id, consumedAt: null },
    data: { consumedAt: new Date(), codePlain: "SUPERSEDED", payload: null },
  });
  const req = await db.securityOtp.create({
    data: {
      purpose: PURPOSE,
      targetUserId: staff.user.id,
      targetUserName: staff.name,
      targetUserEmail: staff.user.email,
      codeHash: "-", // no code — approval happens in the CRM
      payload: await hashPassword(newPin),
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000),
      requestedByName: `${staff.name} (Staff App, ${ip})`,
    },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: req.id,
        action: "STAFF_PIN_RESET_REQUESTED",
        summary: `${staff.name} (${staff.employeeCode}) requested a Staff App PIN reset from ${ip}`,
        actorName: staff.name,
      },
    })
    .catch(() => {});
  await notify({
    kind: "STAFF_PIN_RESET",
    title: `PIN reset request — ${staff.name}`,
    body: `${staff.employeeCode} asked to reset their Staff App PIN. Call them to confirm, then approve or reject.`,
    href: `/staff/${staff.id}`,
  });
  return generic;
}

function canApprove(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS";
}

export async function decideStaffPinReset(requestId: string, approve: boolean) {
  const session = await getSession();
  if (!session || !canApprove(session.role)) return { error: "Only Super Admin or Accounts can approve PIN resets" };
  const req = await db.securityOtp.findUnique({ where: { id: requestId } });
  if (!req || req.purpose !== PURPOSE || req.consumedAt) return { error: "This request is no longer open" };
  if (req.expiresAt < new Date()) return { error: "This request has expired — ask the staff member to request again" };

  const target = await db.user.findUnique({ where: { id: req.targetUserId }, select: { id: true, role: true, isActive: true, staffProfile: { select: { id: true, isActive: true, deletedAt: true } } } });
  if (!target || target.role !== "STAFF") return { error: "Account not found" };
  // A disabled login / staff record never regains access through a reset.
  if (approve && (!target.isActive || !target.staffProfile?.isActive || target.staffProfile.deletedAt)) return { error: "This Staff App login is disabled — enable it first" };

  if (approve && req.payload) {
    await db.user.update({ where: { id: target.id }, data: { passwordHash: req.payload, mustChangePassword: false } });
    await revokeUserSessions(target.id); // old PIN's sessions end everywhere
  }
  await db.securityOtp.update({
    where: { id: req.id },
    data: { consumedAt: new Date(), payload: null, codePlain: `${approve ? "APPROVED" : "REJECTED"} by ${session.name}` },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: req.id,
        action: approve ? "STAFF_PIN_RESET_APPROVED" : "STAFF_PIN_RESET_REJECTED",
        summary: `Staff App PIN reset for ${req.targetUserName} ${approve ? "approved" : "rejected"} by ${session.name}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  if (target.staffProfile) revalidatePath(`/staff/${target.staffProfile.id}`);
  return { success: true as const };
}

// ── Forgot PIN by OTP (SMS to the registered mobile) ──
// Works only when an SMS gateway is configured (Settings → Integrations).
// Otherwise the staff member uses the office-approved request above.
// OTP: 6 digits, bcrypt-hashed, 10 minutes, 5 attempts. The existing PIN is never shown.
const OTP_PURPOSE = "STAFF_PIN_OTP";

async function findStaffLogin(mobile: string, employeeCode?: string) {
  const digits = mobile.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return null;
  const user = await db.user.findFirst({
    where: { phone: digits, role: "STAFF", isActive: true },
    select: { id: true, email: true, phone: true, staffProfile: { select: { id: true, name: true, employeeCode: true, deletedAt: true, isActive: true } } },
  });
  if (!user?.staffProfile || user.staffProfile.deletedAt || !user.staffProfile.isActive) return null;
  const code = employeeCode?.toUpperCase().replace(/\s+/g, "");
  if (code && code !== user.staffProfile.employeeCode.toUpperCase()) return null;
  return { user, staff: user.staffProfile, digits };
}

export async function sendStaffPinOtp(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffotp:ip:${ip}`, 5, 600).allowed) return { error: "Too many requests. Try again in a few minutes." };
  const parsed = z.object({ mobile: z.string().trim().min(10).max(15), employeeCode: z.string().trim().max(20).optional() }).safeParse(values);
  if (!parsed.success) return { error: "Enter your 10-digit mobile number" };
  const { isSmsReady, sendSMS } = await import("@/lib/sms");
  if (!(await isSmsReady())) return { error: "OTP by SMS is not available yet. Use “Ask the office to reset” below.", fallback: true as const };
  const generic = { success: true as const, message: "If this number is registered, an OTP has been sent by SMS." };
  const found = await findStaffLogin(parsed.data.mobile, parsed.data.employeeCode);
  if (!found || !rateLimit(`staffotp:acct:${found.digits}`, 3, 3600).allowed) return generic;
  const { randomInt } = await import("node:crypto");
  const otp = String(randomInt(100000, 1000000));
  await db.securityOtp.updateMany({ where: { purpose: OTP_PURPOSE, targetUserId: found.user.id, consumedAt: null }, data: { consumedAt: new Date() } });
  const row = await db.securityOtp.create({
    data: {
      purpose: OTP_PURPOSE,
      targetUserId: found.user.id,
      targetUserName: found.staff.name,
      targetUserEmail: found.user.email,
      codeHash: await hashPassword(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      requestedByName: `${found.staff.name} (Staff App, ${ip})`,
    },
  });
  const sms = await sendSMS({ kind: "OTHER", toNumber: found.digits, toName: found.staff.name, body: `Sahara Staff App OTP: ${otp}. Valid 10 minutes. Do not share it.`, relatedType: "SecurityOtp", relatedId: row.id, sensitive: true });
  if (!sms.sent) {
    // Never report a delivery that didn't happen.
    await db.securityOtp.update({ where: { id: row.id }, data: { consumedAt: new Date(), codePlain: "SMS_FAILED" } });
    await db.auditLog.create({ data: { entityType: "Security", entityId: row.id, action: "STAFF_PIN_OTP_FAILED", summary: `PIN reset OTP SMS to ${found.staff.employeeCode} ${found.staff.name} failed: ${sms.error ?? "not sent"}`, actorName: found.staff.name } }).catch(() => {});
    return { error: "We could not send the SMS right now. Use “Ask the office to reset” below.", fallback: true as const };
  }
  await db.auditLog.create({ data: { entityType: "Security", entityId: row.id, action: "STAFF_PIN_OTP_SENT", summary: `PIN reset OTP sent to ${found.staff.employeeCode} ${found.staff.name}`, actorName: found.staff.name } }).catch(() => {});
  return generic;
}

export async function resetStaffPinWithOtp(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffotpverify:ip:${ip}`, 10, 600).allowed) return { error: "Too many attempts. Try again later." };
  const parsed = z
    .object({ mobile: z.string().trim().min(10).max(15), otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"), newPin: staffPinSchema, confirmPin: z.string() })
    .refine((v) => v.newPin === v.confirmPin, { message: "PINs do not match", path: ["confirmPin"] })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const bad = { error: "OTP is wrong or expired" };
  const found = await findStaffLogin(parsed.data.mobile);
  if (!found) return bad;
  const req = await db.securityOtp.findFirst({ where: { purpose: OTP_PURPOSE, targetUserId: found.user.id, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!req || req.attempts >= 5) return bad;
  const { verifyPassword } = await import("@/lib/auth");
  if (!(await verifyPassword(parsed.data.otp, req.codeHash))) {
    await db.securityOtp.update({ where: { id: req.id }, data: { attempts: { increment: 1 } } });
    return bad;
  }
  const used = await db.securityOtp.updateMany({ where: { id: req.id, consumedAt: null }, data: { consumedAt: new Date(), codePlain: "USED" } });
  if (used.count !== 1) return bad;
  await db.user.update({ where: { id: found.user.id }, data: { passwordHash: await hashPassword(parsed.data.newPin), mustChangePassword: false } });
  await revokeUserSessions(found.user.id); // sign out every other device
  await db.auditLog.create({ data: { entityType: "Security", entityId: req.id, action: "STAFF_PIN_RESET_BY_OTP", summary: `${found.staff.employeeCode} ${found.staff.name} reset their PIN by SMS OTP`, actorName: found.staff.name } }).catch(() => {});
  return { success: true as const };
}
