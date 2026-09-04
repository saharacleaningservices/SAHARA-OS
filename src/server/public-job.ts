import { db } from "@/lib/db";
import { LEGACY_TO_SERVICE_CATEGORY } from "@/lib/constants";

/** Deterministic referral code from a mobile number — no separate table needed. */
export function referralCodeForMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  return `SAHARA-${digits.slice(-4) || "0000"}`;
}

/** Data for the public, unauthenticated job/booking confirmation page shared
 * with the customer (same "guessable-id, no session" posture already used
 * by /api/quotations/[id]/pdf and /api/certificates/[id]/pdf). */
export async function getPublicJobSummary(jobNumber: string) {
  const job = await db.job.findFirst({
    where: { jobNumber, deletedAt: null },
    include: {
      photos: { orderBy: { uploadedAt: "asc" } },
      videos: { orderBy: { uploadedAt: "asc" } },
      certificate: true,
    },
  });
  if (!job) return null;

  const triggerCategory = LEGACY_TO_SERVICE_CATEGORY[job.service] ?? job.service;
  const [settings, offer] = await Promise.all([
    db.companySettings.findUnique({ where: { id: "default" } }),
    db.upsellRule.findFirst({ where: { triggerCategory: triggerCategory as never, isActive: true } }),
  ]);

  return {
    job,
    googleReviewUrl: settings?.googleReviewUrl ?? null,
    offer,
    referralCode: referralCodeForMobile(job.customerMobile),
  };
}
