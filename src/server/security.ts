// Security OTP — for password reset / change. The 6-digit code is ALWAYS
// delivered to the Super Admin (Altaf), never to the account whose password
// is changing. The pending new-password hash is stashed on the OTP row and
// only applied once Altaf relays the code and it's confirmed.

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { notify } from "@/server/notify";

const OTP_TTL_MINUTES = 20;
const MAX_ATTEMPTS = 5;

function sixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Create an OTP for a pending password change. Returns the OTP row id the
 * client holds until Altaf relays the code. Notifies Altaf (in-app + push +
 * WhatsApp) and records the plaintext code on the row so the admin can also
 * read it from /admin/security-approvals when WhatsApp isn't connected.
 */
export async function requestPasswordOtp(opts: {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  newPassword: string;
  purpose: "PASSWORD_CHANGE" | "PASSWORD_RESET";
  requestedByName?: string;
}) {
  const code = sixDigit();
  const [codeHash, payload] = await Promise.all([hashPassword(code), hashPassword(opts.newPassword)]);

  // Invalidate any earlier open OTPs for the same target.
  await db.securityOtp.updateMany({
    where: { targetUserId: opts.targetUserId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = await db.securityOtp.create({
    data: {
      purpose: opts.purpose,
      targetUserId: opts.targetUserId,
      targetUserName: opts.targetUserName,
      targetUserEmail: opts.targetUserEmail,
      codeHash,
      codePlain: code,
      payload,
      requestedByName: opts.requestedByName ?? opts.targetUserName,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: otp.id,
        action: "PASSWORD_OTP_REQUESTED",
        summary: `Password ${opts.purpose === "PASSWORD_RESET" ? "reset" : "change"} requested for ${opts.targetUserName} (${opts.targetUserEmail})`,
        actorName: opts.requestedByName ?? opts.targetUserName,
        actorEmail: opts.targetUserEmail,
      },
    })
    .catch(() => {});

  await notify({
    kind: "PASSWORD_OTP",
    title: "Password change needs your OK",
    body: `${opts.targetUserName} wants to change their password. OTP: ${code} (valid ${OTP_TTL_MINUTES} min). Share it only if you approve.`,
    href: "/admin/security-approvals",
    whatsappToAdmin: true,
    meta: { otpId: otp.id, targetUserEmail: opts.targetUserEmail },
  });

  return { otpId: otp.id, ttlMinutes: OTP_TTL_MINUTES };
}

/** Confirm an OTP and apply the pending password. */
export async function confirmPasswordOtp(otpId: string, code: string) {
  const otp = await db.securityOtp.findUnique({ where: { id: otpId } });
  if (!otp) return { error: "This request was not found. Start again." as const };
  if (otp.consumedAt) return { error: "This code was already used. Start again." as const };
  if (otp.expiresAt < new Date()) return { error: "This code has expired. Start again." as const };
  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.securityOtp.update({ where: { id: otpId }, data: { consumedAt: new Date() } });
    return { error: "Too many wrong attempts. Start again." as const };
  }

  const { verifyPassword } = await import("@/lib/auth");
  const ok = await verifyPassword(code.trim(), otp.codeHash);
  if (!ok) {
    await db.securityOtp.update({ where: { id: otpId }, data: { attempts: { increment: 1 } } });
    return { error: "Incorrect code." as const };
  }

  if (!otp.payload) return { error: "Nothing to apply. Start again." as const };
  await db.user.update({
    where: { id: otp.targetUserId },
    data: { passwordHash: otp.payload, mustChangePassword: false },
  });
  await db.securityOtp.update({ where: { id: otpId }, data: { consumedAt: new Date() } });

  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: otp.id,
        action: "PASSWORD_CHANGED",
        summary: `Password changed for ${otp.targetUserName} (${otp.targetUserEmail}) after Super Admin OTP approval`,
        actorName: otp.requestedByName,
        actorEmail: otp.targetUserEmail,
      },
    })
    .catch(() => {});

  await notify({
    kind: "PASSWORD_OTP",
    title: "Password changed",
    body: `${otp.targetUserName}'s password was changed just now (OTP-approved).`,
    href: "/admin/audit-log",
  });

  return { success: true as const };
}

/** Open (unconsumed, unexpired) OTPs — shown to the admin as a relay list. */
export async function getOpenSecurityOtps() {
  return db.securityOtp.findMany({
    where: { consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}
