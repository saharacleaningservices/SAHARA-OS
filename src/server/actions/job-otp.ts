"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendWhatsApp } from "@/lib/whatsapp";
import { jobOtpMessage } from "@/lib/whatsapp-templates";
import { rateLimit } from "@/lib/rate-limit";
import { generateOtpCode, hashOtp, otpMatches, JOB_OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { canAccessJob, getOwnStaffId } from "@/server/jobs";
import { revalidatePath } from "next/cache";

type Purpose = "START" | "COMPLETE";

async function authorizedJob(jobId: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const };
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { assignments: { select: { staffId: true } } },
  });
  if (!job || job.deletedAt) return { error: "Job not found" as const };
  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) return { error: "Not authorized" as const };
  return { session, job };
}

/** Sends a fresh 6-digit code to the customer's WhatsApp (logged as the fallback if Meta isn't configured). */
export async function requestJobOtp(jobId: string, purpose: Purpose) {
  if (purpose !== "START" && purpose !== "COMPLETE") return { error: "Invalid request" };
  const auth = await authorizedJob(jobId);
  if ("error" in auth) return { error: auth.error };
  const { job } = auth;

  if (!rateLimit(`job-otp:send:${jobId}:${purpose}`, 3, 600).allowed) {
    return { error: "Too many codes requested. Wait a few minutes and try again." };
  }

  const code = generateOtpCode();
  const row = await db.jobOtp.create({
    data: { jobId, purpose, codeHash: "pending", expiresAt: new Date(Date.now() + JOB_OTP_TTL_MINUTES * 60_000) },
  });
  await db.jobOtp.update({ where: { id: row.id }, data: { codeHash: hashOtp(code, `job:${row.id}`) } });

  const res = await sendWhatsApp({
    kind: "JOB_OTP",
    toNumber: job.customerMobile,
    toName: job.customerName,
    body: jobOtpMessage({ customerName: job.customerName, jobNumber: job.jobNumber, purpose, code }),
    relatedType: "Job",
    relatedId: jobId,
  });

  return {
    success: true as const,
    // true when Meta isn't configured / send failed — code is in Admin → WhatsApp Log.
    fallbackLogged: !res.sent,
  };
}

export async function verifyJobOtp(jobId: string, purpose: Purpose, code: string) {
  if (purpose !== "START" && purpose !== "COMPLETE") return { error: "Invalid request" };
  if (!/^\d{6}$/.test(code.trim())) return { error: "Enter the 6-digit code." };
  const auth = await authorizedJob(jobId);
  if ("error" in auth) return { error: auth.error };

  // Latest unverified, unexpired code for this job+purpose.
  const row = await db.jobOtp.findFirst({
    where: { jobId, purpose, verifiedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { error: "No valid code. Send a new OTP to the customer." };

  if (!otpMatches(code, `job:${row.id}`, row.codeHash)) {
    await db.jobOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { error: "Incorrect code. Please try again." };
  }

  const claimed = await db.jobOtp.updateMany({ where: { id: row.id, verifiedAt: null }, data: { verifiedAt: new Date() } });
  if (claimed.count !== 1) return { error: "That code was already used. Send a new OTP." };

  await db.activityLog.create({
    data: { jobId, actorId: auth.session.sub, action: `Customer ${purpose === "START" ? "start" : "completion"} OTP verified` },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}
