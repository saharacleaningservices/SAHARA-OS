import { db } from "@/lib/db";
import { jobOtpEnforced } from "@/lib/otp";

export type OtpPurpose = "START" | "COMPLETE";

const VERIFIED_VALID_HOURS = 12;

export async function isJobOtpVerified(jobId: string, purpose: OtpPurpose): Promise<boolean> {
  const since = new Date(Date.now() - VERIFIED_VALID_HOURS * 3_600_000);
  const row = await db.jobOtp.findFirst({ where: { jobId, purpose, verifiedAt: { gte: since } }, select: { id: true } });
  return Boolean(row);
}

export async function getJobOtpState(jobId: string) {
  const [startVerified, completeVerified] = await Promise.all([
    isJobOtpVerified(jobId, "START"),
    isJobOtpVerified(jobId, "COMPLETE"),
  ]);
  return { enforced: jobOtpEnforced(), startVerified, completeVerified };
}

/**
 * Gate for status transitions. Admin/Operations may always override (logged);
 * everyone else needs a verified customer OTP when JOB_OTP_ENFORCE=on.
 */
export async function checkJobOtpGate(
  jobId: string,
  status: "STARTED" | "COMPLETED",
  role: string | undefined
): Promise<{ ok: true; overridden: boolean } | { ok: false; error: string }> {
  if (!jobOtpEnforced()) return { ok: true, overridden: false };
  const purpose: OtpPurpose = status === "STARTED" ? "START" : "COMPLETE";
  if (await isJobOtpVerified(jobId, purpose)) return { ok: true, overridden: false };
  if (role === "ADMIN" || role === "OPERATIONS") return { ok: true, overridden: true };
  return {
    ok: false,
    error: `Customer ${purpose === "START" ? "start" : "completion"} OTP not verified. Ask the customer for the code sent to their WhatsApp.`,
  };
}
