"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { forgotLoginIdSchema } from "@/lib/validation";

/**
 * "Forgot Login ID?" — for a user who remembers their name but not which
 * mobile number / email they registered with (the login ID here IS the
 * mobile number or email, there's no separate username field). No session
 * required.
 *
 * Same owner-approval pattern as password reset: never reveals whether a
 * name matches an account (identical response either way), and the actual
 * login ID is never sent back to the browser until a one-time code — sent
 * only to the fixed owner-controlled recovery contact (COMPANY.phones[0] /
 * COMPANY.email), never to the account being recovered — is confirmed. See
 * requestLoginIdOtp/confirmLoginIdOtp in src/server/security.ts.
 */
type RequestResult = { error: string } | { error?: undefined; otpRequired: true; otpId: string; ttlMinutes: number };

export async function requestLoginIdRecovery(values: unknown): Promise<RequestResult> {
  const hdrs = await headers();
  const ip = clientIp(hdrs);

  const ipLimit = rateLimit(`loginid:ip:${ip}`, 5, 600);
  if (!ipLimit.allowed) {
    return { error: "Too many requests. Try again in a few minutes." };
  }

  const parsed = forgotLoginIdSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { name } = parsed.data;

  const acctLimit = rateLimit(`loginid:name:${name.toLowerCase()}`, 3, 600);
  if (!acctLimit.allowed) {
    return { error: "Too many requests for this name. Try again in a few minutes." };
  }

  // SQLite (this app's database) doesn't support Prisma's `mode:
  // "insensitive"` filter — do the case-insensitive match in JS instead. The
  // team is small enough that fetching active users is cheap.
  const activeUsers = await db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true, email: true } });
  const user = activeUsers.find((u) => u.name.trim().toLowerCase() === name.toLowerCase());

  // Always the same response shape whether or not a match was found, so
  // this form never leaks which names have accounts. Only a real match
  // actually raises an OTP.
  if (user) {
    const { requestLoginIdOtp } = await import("@/server/security");
    const loginId = user.phone ? `Mobile: ${user.phone}` : `Email: ${user.email}`;
    const { otpId, ttlMinutes } = await requestLoginIdOtp({
      targetUserId: user.id,
      targetUserName: user.name,
      targetUserEmail: user.email,
      loginId,
      requestedByName: name,
    });
    return { otpRequired: true as const, otpId, ttlMinutes };
  }

  return { otpRequired: true as const, otpId: "", ttlMinutes: 20 };
}

type ConfirmResult = { error: string } | { error?: undefined; success: true; loginId: string };

/** Step 2 — reveal the login ID once the Super Admin's OTP is confirmed. */
export async function confirmLoginIdRecovery(otpId: string, code: string): Promise<ConfirmResult> {
  if (!otpId || !code?.trim()) return { error: "Enter the code from the Super Admin" };

  const hdrs = await headers();
  const ip = clientIp(hdrs);
  const limit = rateLimit(`loginid:confirm:${ip}`, 10, 600);
  if (!limit.allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const { confirmLoginIdOtp } = await import("@/server/security");
  return confirmLoginIdOtp(otpId, code);
}
