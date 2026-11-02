// Customer order tracker (/track) — Job ID + 4-digit WhatsApp OTP (Phase 2, 2026-11-02; 4 digits per owner refinement).
// Not a "use server" module: the browser reaches it only through src/server/actions/order-track.ts.
//
// Security: the response never reveals whether a Job ID or mobile exists; codes are random 4-digit (Job ID + matching mobile
// are required too, with 5 tries per code and per-IP/job/mobile rate limits, so guessing stays impractical), stored only as a salted
// SHA-256 hash in SecurityOtp (purpose ORDER_TRACK), valid 10 minutes, single use, 5 wrong tries max; requests are
// rate-limited per IP, per job and per mobile. A correct code opens the job's existing tokenised booking page.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { bookingPageUrl, ensureJobToken } from "@/server/booking-messages";

const PURPOSE = "ORDER_TRACK";
const TTL_MS = 10 * 60_000;
const MAX_TRIES = 5;
export const OTP_LENGTH = 4;
const GENERIC = "If the Job ID and mobile number match our records, a 4-digit code has been sent on WhatsApp.";

export const normalizeJobNumber = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");
const last10 = (v: string) => v.replace(/\D/g, "").slice(-10);
const hashCode = (code: string, jobId: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? "sahara"}:${jobId}:${code}`).digest("hex");

async function findJob(jobNumber: string, mobile: string) {
  const job = await db.job.findFirst({ where: { jobNumber: normalizeJobNumber(jobNumber), deletedAt: null }, select: { id: true, jobNumber: true, customerName: true, customerMobile: true } });
  if (!job || last10(job.customerMobile) !== last10(mobile)) return null;
  return job;
}

export async function requestTrackCode(input: { jobNumber: string; mobile: string }, ip: string | null) {
  const jobNumber = normalizeJobNumber(input.jobNumber ?? "");
  const mobile = last10(input.mobile ?? "");
  if (!/^[A-Z]{2,5}-\d{4}-\d{3,6}$/.test(jobNumber)) return { ok: false as const, error: "Enter your Job ID as shown on your booking, e.g. JOB-2026-0123." };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false as const, error: "Enter the 10-digit mobile number used for the booking." };
  if ((ip && !rateLimit(`track:ip:${ip}`, 6, 600).allowed) || !rateLimit(`track:job:${jobNumber}`, 3, 600).allowed || !rateLimit(`track:mob:${mobile}`, 3, 600).allowed) {
    return { ok: false as const, error: "Too many attempts — please wait 10 minutes or WhatsApp us." };
  }
  const job = await findJob(jobNumber, mobile);
  if (!job) return { ok: true as const, message: GENERIC }; // same answer either way
  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  await db.securityOtp.updateMany({ where: { purpose: PURPOSE, targetUserId: job.id, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.securityOtp.create({ data: { purpose: PURPOSE, targetUserId: job.id, targetUserName: job.customerName, targetUserEmail: "", codeHash: hashCode(code, job.id), expiresAt: new Date(Date.now() + TTL_MS), requestedByName: "Customer /track" } });
  // Business-initiated WhatsApp needs an approved AUTHENTICATION template (WHATSAPP_OTP_TEMPLATE, one {{1}} = code) to reach a
  // customer outside the 24-hour chat window; plain text works inside it (e.g. right after the customer messages Sahara).
  const tpl = process.env.WHATSAPP_OTP_TEMPLATE?.trim();
  const body = `${code} is your Sahara order tracking code for ${job.jobNumber}. Valid for 10 minutes. Do not share it with anyone.`;
  if (tpl && process.env.WHATSAPP_USE_TEMPLATES === "on") {
    await sendWhatsAppTemplate({ kind: "OTHER", toNumber: job.customerMobile, toName: job.customerName, templateName: tpl, languageCode: "en", bodyParams: [code], buttonUrlParams: [{ index: 0, value: code }], preview: `Order tracking code for ${job.jobNumber}`, relatedType: "Job", relatedId: job.id }).catch(() => null);
  } else {
    await sendWhatsApp({ kind: "OTHER", toNumber: job.customerMobile, toName: job.customerName, body, relatedType: "Job", relatedId: job.id }).catch(() => null);
  }
  return { ok: true as const, message: GENERIC };
}

export async function verifyTrackCode(input: { jobNumber: string; mobile: string; code: string }, ip: string | null) {
  const code = (input.code ?? "").replace(/\D/g, "");
  if (code.length !== OTP_LENGTH) return { ok: false as const, error: "Enter the 4-digit code." };
  if (ip && !rateLimit(`trackv:ip:${ip}`, 15, 600).allowed) return { ok: false as const, error: "Too many attempts — please wait 10 minutes." };
  const job = await findJob(input.jobNumber ?? "", input.mobile ?? "");
  if (!job) return { ok: false as const, error: "That code is not valid. Request a new one." };
  const otp = await db.securityOtp.findFirst({ where: { purpose: PURPOSE, targetUserId: job.id, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date() || otp.attempts >= MAX_TRIES) return { ok: false as const, error: "That code has expired. Request a new one." };
  const good = timingSafeEqual(Buffer.from(otp.codeHash, "hex"), Buffer.from(hashCode(code, job.id), "hex"));
  if (!good) {
    await db.securityOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: `That code is not valid. ${Math.max(0, MAX_TRIES - otp.attempts - 1)} tries left.` };
  }
  await db.securityOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  const token = await ensureJobToken(job.id);
  return { ok: true as const, url: bookingPageUrl(token) };
}
