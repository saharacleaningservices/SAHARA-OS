import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function pepper() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

/** HMAC of the code, bound to a purpose+subject so a code can't be replayed elsewhere. */
export function hashOtp(code: string, scope: string): string {
  return createHmac("sha256", pepper()).update(`${scope}:${code}`).digest("hex");
}

export function otpMatches(code: string, scope: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code.trim(), scope), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const LOGIN_OTP_TTL_MINUTES = 10;
export const JOB_OTP_TTL_MINUTES = 30;

/** Staff login OTP is opt-in (STAFF_LOGIN_OTP=on) so deploys never lock people out before WhatsApp is live. */
export function staffLoginOtpEnabled(): boolean {
  return process.env.STAFF_LOGIN_OTP === "on";
}

/** Customer start/complete OTP must be verified before a job advances only when JOB_OTP_ENFORCE=on. */
export function jobOtpEnforced(): boolean {
  return process.env.JOB_OTP_ENFORCE === "on";
}
