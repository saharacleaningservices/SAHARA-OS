"use server";

// Staff App first-time registration (2026-10-13):
//   registered mobile → SMS OTP → staff chooses a password/PIN → office
//   approval (Settings: staffSignupNeedsApproval, default ON) → login enabled.
// Unknown numbers, disabled staff and staff who already have a login can never
// create an account here (the public responses never reveal which case applied).
// OTP: 6 digits, bcrypt-hashed, 10 minutes, 5 attempts, rate limited per IP and
// per number; the SMS log keeps no readable code. Approve/reject: Super Admin
// or Accounts, server-checked. Every step is written to the Audit Log.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { staffPinSchema } from "@/lib/validation";
import { notify } from "@/server/notify";
import { getOpsSettings } from "@/server/ops-reminders";
import { REG_OTP_PURPOSE, REG_REQUEST_PURPOSE, findRegistrableStaff, createStaffLogin } from "@/server/staff-registration";

const OTP_TTL_MIN = 10;
const REQUEST_TTL_DAYS = 7;
const GENERIC = "If this number belongs to a Sahara staff member without an app account, an OTP has been sent by SMS.";

async function audit(entityId: string, action: string, summary: string, actor?: { name: string; email?: string }) {
  await db.auditLog
    .create({ data: { entityType: "Security", entityId, action, summary, actorName: actor?.name ?? null, actorEmail: actor?.email ?? null } })
    .catch(() => {});
}

export async function sendStaffRegistrationOtp(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffreg:ip:${ip}`, 5, 600).allowed) return { error: "Too many requests. Try again in a few minutes." };
  const parsed = z.object({ mobile: z.string().trim().min(10).max(15) }).safeParse(values);
  if (!parsed.success) return { error: "Enter your 10-digit mobile number" };

  const { isSmsReady, sendSMS } = await import("@/lib/sms");
  if (!(await isSmsReady())) return { error: "OTP by SMS is not available yet. Please ask the office to create your Staff App login.", fallback: true as const };

  const staff = await findRegistrableStaff(parsed.data.mobile);
  if (!staff) {
    await audit(parsed.data.mobile.replace(/\D/g, "").slice(-4), "STAFF_REGISTRATION_REFUSED", `Staff App registration OTP refused (not an eligible staff number, ending ${parsed.data.mobile.replace(/\D/g, "").slice(-4)}) from ${ip}`);
    return { success: true as const, message: GENERIC };
  }
  if (!rateLimit(`staffreg:acct:${staff.digits}`, 3, 3600).allowed) return { success: true as const, message: GENERIC };

  const otp = String(randomInt(100000, 1000000));
  await db.securityOtp.updateMany({ where: { purpose: REG_OTP_PURPOSE, targetUserId: staff.id, consumedAt: null }, data: { consumedAt: new Date(), codePlain: "SUPERSEDED" } });
  const row = await db.securityOtp.create({
    data: {
      purpose: REG_OTP_PURPOSE,
      targetUserId: staff.id,
      targetUserName: staff.name,
      targetUserEmail: `${staff.employeeCode.toLowerCase()}@staff.sahara.invalid`,
      codeHash: await hashPassword(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
      requestedByName: `${staff.name} (Staff App registration, ${ip})`,
    },
  });
  const sms = await sendSMS({
    kind: "OTHER",
    toNumber: staff.digits,
    toName: staff.name,
    body: `Sahara Staff App registration OTP: ${otp}. Valid ${OTP_TTL_MIN} minutes. Do not share it.`,
    relatedType: "SecurityOtp",
    relatedId: row.id,
    sensitive: true,
  });
  if (!sms.sent) {
    await db.securityOtp.update({ where: { id: row.id }, data: { consumedAt: new Date(), codePlain: "SMS_FAILED" } });
    await audit(row.id, "STAFF_REGISTRATION_OTP_FAILED", `Registration OTP SMS to ${staff.employeeCode} ${staff.name} failed: ${sms.error ?? "not sent"}`);
    return { error: "We could not send the SMS right now. Try again later or ask the office to create your login.", fallback: true as const };
  }
  await audit(row.id, "STAFF_REGISTRATION_OTP_SENT", `Registration OTP sent to ${staff.employeeCode} ${staff.name} from ${ip}`, { name: staff.name });
  return { success: true as const, message: GENERIC };
}

const completeSchema = z
  .object({
    mobile: z.string().trim().min(10).max(15),
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
    password: staffPinSchema,
    confirmPassword: z.string().min(1, "Enter it again"),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "They do not match", path: ["confirmPassword"] });

export async function completeStaffRegistration(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffregverify:ip:${ip}`, 10, 600).allowed) return { error: "Too many attempts. Try again later." };
  const parsed = completeSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const bad = { error: "OTP is wrong or expired" };

  const staff = await findRegistrableStaff(parsed.data.mobile);
  if (!staff) return bad;
  const otpRow = await db.securityOtp.findFirst({
    where: { purpose: REG_OTP_PURPOSE, targetUserId: staff.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otpRow || otpRow.attempts >= 5) return bad;
  if (!(await verifyPassword(parsed.data.otp, otpRow.codeHash))) {
    await db.securityOtp.update({ where: { id: otpRow.id }, data: { attempts: { increment: 1 } } });
    return bad;
  }
  // Single use: consume atomically so a double submit can't register twice.
  const used = await db.securityOtp.updateMany({ where: { id: otpRow.id, consumedAt: null }, data: { consumedAt: new Date(), codePlain: "USED" } });
  if (used.count !== 1) return bad;

  const passwordHash = await hashPassword(parsed.data.password);
  const settings = await getOpsSettings();

  if (!settings.staffSignupNeedsApproval) {
    const res = await createStaffLogin(staff, passwordHash).catch(() => ({ error: "Could not create the login — ask the office" }) as const);
    if ("error" in res) return { error: res.error };
    await audit(res.userId, "STAFF_REGISTERED", `${staff.employeeCode} ${staff.name} registered for the Staff App by SMS OTP (no approval required) from ${ip}`, { name: staff.name });
    await notify({ kind: "STAFF_REGISTRATION", title: `Staff App registration — ${staff.name}`, body: `${staff.employeeCode} registered and can now sign in.`, href: `/staff/${staff.id}` });
    return { success: true as const, pendingApproval: false };
  }

  // One open request per staff member — a newer one supersedes the older.
  await db.securityOtp.updateMany({ where: { purpose: REG_REQUEST_PURPOSE, targetUserId: staff.id, consumedAt: null }, data: { consumedAt: new Date(), codePlain: "SUPERSEDED", payload: null } });
  const req = await db.securityOtp.create({
    data: {
      purpose: REG_REQUEST_PURPOSE,
      targetUserId: staff.id,
      targetUserName: staff.name,
      targetUserEmail: `${staff.employeeCode.toLowerCase()}@staff.sahara.invalid`,
      codeHash: "-",
      payload: passwordHash,
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 3600 * 1000),
      requestedByName: `${staff.name} (Staff App registration, ${ip})`,
    },
  });
  await audit(req.id, "STAFF_REGISTRATION_REQUESTED", `${staff.employeeCode} ${staff.name} verified their mobile by OTP and requested Staff App access from ${ip}`, { name: staff.name });
  await notify({
    kind: "STAFF_REGISTRATION",
    title: `Staff App access request — ${staff.name}`,
    body: `${staff.employeeCode} verified their mobile by OTP. Approve or reject on the Staff page.`,
    href: `/staff/${staff.id}`,
  });
  return { success: true as const, pendingApproval: true };
}

export async function decideStaffRegistration(requestId: string, approve: boolean) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return { error: "Only Super Admin or Accounts can approve Staff App registrations" };
  const req = await db.securityOtp.findUnique({ where: { id: requestId } });
  if (!req || req.purpose !== REG_REQUEST_PURPOSE || req.consumedAt) return { error: "This request is no longer open" };
  if (req.expiresAt < new Date()) return { error: "This request has expired — the staff member must register again" };

  let note = approve ? "APPROVED" : "REJECTED";
  if (approve) {
    const staffRow = await db.staff.findUnique({ where: { id: req.targetUserId }, select: { mobile: true } });
    // Re-check eligibility now: the staff member may have been disabled or given a login meanwhile.
    const staff = staffRow ? await findRegistrableStaff(staffRow.mobile) : null;
    if (!staff || staff.id !== req.targetUserId || !req.payload) return { error: "This staff member can no longer register (disabled, removed or already has a login)" };
    const res = await createStaffLogin(staff, req.payload).catch(() => ({ error: "Could not create the login" }) as const);
    if ("error" in res) return { error: res.error };
    note = `APPROVED → user ${res.userId}`;
  }
  const closed = await db.securityOtp.updateMany({
    where: { id: req.id, consumedAt: null },
    data: { consumedAt: new Date(), payload: null, codePlain: `${note} by ${session.name}` },
  });
  if (closed.count !== 1) return { error: "This request is no longer open" };
  await audit(req.id, approve ? "STAFF_REGISTRATION_APPROVED" : "STAFF_REGISTRATION_REJECTED", `Staff App registration for ${req.targetUserName} ${approve ? "approved" : "rejected"} by ${session.name}`, session);
  revalidatePath("/staff");
  revalidatePath(`/staff/${req.targetUserId}`);
  return { success: true as const };
}
