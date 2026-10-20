import { db } from "@/lib/db";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { premiumReviewRequestMessage } from "@/lib/whatsapp-templates";
import { SERVICE_LABELS } from "@/lib/constants";
import { bookingPageUrl, ensureJobToken } from "@/server/booking-messages";

// Google-review request. Not a "use server" module on purpose: these helpers must never be callable from the browser.
// The review is asked for once per job (the WhatsAppMessage check inside sendJobCompletionReview), and only when the
// job is COMPLETED and nothing is left to collect — so a customer is never asked for a review while a balance is
// still due. It is called from job completion (covers fully pre-paid jobs) and from payment collection (covers the
// usual pay-after-service case, i.e. "Payment Collected").

/**
 * Sends the "Job Completed — leave a Google Review" WhatsApp message exactly
 * once per job, the moment its status becomes COMPLETED — regardless of
 * which completion action triggered it (the plain "Mark Completed" status
 * button via updateJobStatus below, or "Complete & Generate Certificate" via
 * completeJobWithCertificate), and regardless of the job's originating lead
 * source (website booking, manual CRM entry, or GMB — all leads funnel into
 * the same Job model). A WhatsAppMessage existence check guards against a
 * duplicate send if both completion paths somehow run for the same job,
 * mirroring the dedup pattern already used in src/server/reminders.ts.
 */
async function sendJobCompletionReview(job: {
  id: string;
  jobNumber: string;
  customerName: string;
  customerMobile: string;
  service: string;
}) {
  const already = await db.whatsAppMessage.findFirst({
    where: { kind: "REVIEW_REQUEST", relatedType: "Job", relatedId: job.id },
  });
  if (already) return;

  // WHATSAPP_REVIEW_TEMPLATE=v2 (with templates on) → approved-template review with a direct
  // Google Review URL button (sahara_review_request_v2). Otherwise the existing message below.
  if (process.env.WHATSAPP_USE_TEMPLATES === "on" && process.env.WHATSAPP_REVIEW_TEMPLATE === "v2") {
    const t = templateByName("sahara_review_request_v2")!;
    const params = [job.customerName, SERVICE_LABELS[job.service] ?? job.service];
    await sendWhatsAppTemplate({
      kind: "REVIEW_REQUEST",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
    return;
  }

  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  await sendWhatsApp({
    kind: "REVIEW_REQUEST",
    toNumber: job.customerMobile,
    toName: job.customerName,
    body: premiumReviewRequestMessage({
      customerName: job.customerName,
      jobNumber: job.jobNumber,
      service: SERVICE_LABELS[job.service] ?? job.service,
      googleReviewUrl: settings?.googleReviewUrl ?? null,
      bookingUrl: bookingPageUrl(await ensureJobToken(job.id)),
    }),
    relatedType: "Job",
    relatedId: job.id,
  });
}


/** True when the job has payment rows and every one of them is still short of its amount. */
export function hasOutstandingBalance(payments: { status: string; amount: number; paidAmount: number }[]): boolean {
  return payments.some((p) => p.status !== "PAID" && p.paidAmount < p.amount - 0.01);
}

/** Sends the review request if the job is completed and fully paid (or has no payment rows). Safe to call repeatedly. */
export async function sendReviewIfDue(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.deletedAt || job.status !== "COMPLETED") return;
  const payments = await db.payment.findMany({ where: { jobId, deletedAt: null }, select: { status: true, amount: true, paidAmount: true } });
  if (hasOutstandingBalance(payments)) return;
  await sendJobCompletionReview(job);
}
