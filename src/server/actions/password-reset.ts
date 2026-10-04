"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation";

/**
 * Step 1 of a self-service password reset — for a user who is locked out
 * and can't sign in to use the Change Password dialog. No session required.
 * Looks the account up by mobile number, then raises the same Super-Admin
 * OTP used by the logged-in Change Password flow (purpose: PASSWORD_RESET).
 * Never reveals whether a given mobile number has an account on file.
 */
export async function requestPasswordReset(values: unknown) {
    const hdrs = await headers();
    const ip = clientIp(hdrs);

  const ipLimit = rateLimit(`pwreset:ip:${ip}`, 5, 600);
    if (!ipLimit.allowed) {
          return { error: "Too many requests. Try again in a few minutes." };
    }

  const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
    }
    const { mobile, newPassword } = parsed.data;
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) return { error: "Enter a valid 10-digit mobile number" };

  const acctLimit = rateLimit(`pwreset:acct:${digits.slice(-10)}`, 3, 600);
    if (!acctLimit.allowed) {
          return { error: "Too many requests for this account. Try again in a few minutes." };
    }

  const user = await db.user.findFirst({ where: { phone: digits.slice(-10) } });

  // Always return the same shape whether or not the account exists, so the
  // form never leaks which mobile numbers are registered. Only a real,
  // active account actually raises an OTP to the Super Admin.
  // Field Staff reset via /staff-reset (approved in the CRM), not the owner-OTP relay.
  if (user && user.isActive && user.role !== "STAFF") {
        const { requestPasswordOtp } = await import("@/server/security");
        const { otpId, ttlMinutes } = await requestPasswordOtp({
                targetUserId: user.id,
                targetUserName: user.name,
                targetUserEmail: user.email,
                newPassword,
                purpose: "PASSWORD_RESET",
                requestedByName: user.name,
        });
        return { otpRequired: true as const, otpId, ttlMinutes };
  }

  return { otpRequired: true as const, otpId: "", ttlMinutes: 20 };
}

/** Step 2 — apply the pending password once the Super Admin's OTP is entered. */
export async function confirmPasswordReset(otpId: string, code: string) {
    if (!otpId || !code?.trim()) return { error: "Enter the code from the Super Admin" };

  const hdrs = await headers();
    const ip = clientIp(hdrs);
    const limit = rateLimit(`pwreset:confirm:${ip}`, 10, 600);
    if (!limit.allowed) {
          return { error: "Too many attempts. Try again in a few minutes." };
    }

  const { confirmPasswordOtp } = await import("@/server/security");
    return confirmPasswordOtp(otpId, code);
}
