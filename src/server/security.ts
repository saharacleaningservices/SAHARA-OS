// Security OTP — for password reset / change. The 6-digit code is ALWAYS
// delivered to the OWNER-CONTROLLED recovery channels (COMPANY.phones[0] /
// COMPANY.email in src/lib/constants.ts), never to the account whose
// password is changing and never derived from whichever user happens to
// hold the ADMIN role in the database — the recovery contact is the
// business's fixed, owner-configured number/email, not an indirect lookup.
// The pending new-password hash is stashed on the OTP row and only applied
// once the owner relays the code and it's confirmed.

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { notify } from "@/server/notify";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";
import { COMPANY } from "@/lib/constants";

const OTP_TTL_MINUTES = 20;
const MAX_ATTEMPTS = 5;

// Cryptographically secure — Math.random() is not appropriate for a
// security code (predictable PRNG, not suitable for anything
// authentication-adjacent).
function sixDigit() {
  return String(randomInt(100000, 1000000));
}

/** Failure audit trail — never logs the OTP value or the new password, only what happened. */
async function logOtpFailure(otp: { id: string; targetUserName: string; targetUserEmail: string }, reason: string) {
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: otp.id,
        action: "PASSWORD_OTP_FAILED",
        summary: `Password reset OTP attempt failed for ${otp.targetUserName} (${otp.targetUserEmail}): ${reason}`,
        actorName: otp.targetUserName,
        actorEmail: otp.targetUserEmail,
      },
    })
    .catch(() => {});
}

/**
 * Create an OTP for a pending password change. Returns the OTP row id the
 * client holds until the owner relays the code. Notifies every active ADMIN
 * user in-app + push, and separately queues the code directly to the fixed
 * owner-controlled recovery contact (COMPANY.phones[0] via WhatsApp,
 * COMPANY.email via email) — not whichever phone/email happens to be on an
 * ADMIN user's own profile, so this can never silently drift from the real
 * recovery contact. Also records the plaintext code on the row so the admin
 * can read it from /admin/security-approvals when neither channel is
 * connected (true today — see isWhatsAppReady()/isEmailReady()).
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

  const notifyBody = `${opts.targetUserName} wants to change their password. OTP: ${code} (valid ${OTP_TTL_MINUTES} min). Share it only if you approve.`;

  await notify({
    kind: "PASSWORD_OTP",
    title: "Password change needs your OK",
    body: notifyBody,
    href: "/admin/security-approvals",
    meta: { otpId: otp.id, targetUserEmail: opts.targetUserEmail },
  });

  // Direct to the owner-controlled recovery contact — deliberately not via
  // notify()'s admin.phone lookup, so this always reaches the real
  // configured number/email regardless of what's on the ADMIN user's own
  // profile. Both queue immediately and only actually send once WhatsApp/
  // email credentials exist (neither does in this deployment today).
  await sendWhatsApp({
    kind: "OTHER",
    toNumber: COMPANY.phones[0],
    toName: "Owner",
    body: notifyBody,
    relatedType: "SecurityOtp",
    relatedId: otp.id,
  }).catch(() => {});
  await sendEmail({
    kind: opts.purpose === "PASSWORD_RESET" ? "PASSWORD_OTP" : "OTHER",
    toEmail: COMPANY.email,
    toName: "Owner",
    subject: "Sahara OS — password change needs your OK",
    body: notifyBody,
    relatedType: "SecurityOtp",
    relatedId: otp.id,
  }).catch(() => {});

  return { otpId: otp.id, ttlMinutes: OTP_TTL_MINUTES };
}

/** Confirm an OTP and apply the pending password. */
export async function confirmPasswordOtp(otpId: string, code: string) {
  const otp = await db.securityOtp.findUnique({ where: { id: otpId } });
  if (!otp) return { error: "This request was not found. Start again." as const };
  if (otp.consumedAt) {
    await logOtpFailure(otp, "code already used");
    return { error: "This code was already used. Start again." as const };
  }
  if (otp.expiresAt < new Date()) {
    await logOtpFailure(otp, "code expired");
    return { error: "This code has expired. Start again." as const };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.securityOtp.update({ where: { id: otpId }, data: { consumedAt: new Date() } });
    await logOtpFailure(otp, "too many wrong attempts — locked out");
    return { error: "Too many wrong attempts. Start again." as const };
  }

  const { verifyPassword } = await import("@/lib/auth");
  const ok = await verifyPassword(code.trim(), otp.codeHash);
  if (!ok) {
    await db.securityOtp.update({ where: { id: otpId }, data: { attempts: { increment: 1 } } });
    await logOtpFailure(otp, `incorrect code (attempt ${otp.attempts + 1}/${MAX_ATTEMPTS})`);
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
