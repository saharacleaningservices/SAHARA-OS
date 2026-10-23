// What the background queue runs. Not a "use server" module: nothing here is callable from the browser.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { randomBytes } from "node:crypto";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { dispatchTeamForJob } from "@/server/dispatch";
import { customerPaymentStatus, ensureJobToken } from "@/server/booking-messages";
import { enqueueJob, runDueJobs } from "@/server/job-queue";

/** Crew dispatch for a job, in the background. One unfinished dispatch per job at a time. */
export const enqueueTeamDispatch = (jobId: string) => enqueueJob("TEAM_DISPATCH", { jobId }, { dedupeKey: `dispatch:${jobId}` });

/** "Job completed" customer notice with the Pay Balance link, in the background. Sent at most once per job. */
export const enqueueJobCompletedNotice = (jobId: string) => enqueueJob("JOB_COMPLETED_NOTICE", { jobId }, { dedupeKey: `completed:${jobId}` });

/** Estimate link to the customer the moment a quotation is created, in the background. */
export const enqueueQuotationNotice = (quotationId: string) => enqueueJob("QUOTATION_NOTICE", { quotationId }, { dedupeKey: `quotation:${quotationId}` });

/** "Work started" customer message, in the background. Once per job. */
export const enqueueServiceStartedNotice = (jobId: string) => enqueueJob("SERVICE_STARTED_NOTICE", { jobId }, { dedupeKey: `started:${jobId}` });

/**
 * sahara_service_started_v1 — sent when staff mark Work Started. Template only (a plain message would be rejected by WhatsApp for a
 * customer who has not written to us in the last 24 h), so it stays off until Meta approves the template and the owner sets
 * WHATSAPP_USE_TEMPLATES=on + WHATSAPP_STARTED_TEMPLATE=v1. Outbound mode still decides who can receive it.
 */
export async function sendServiceStartedNotice(jobId: string) {
  if (process.env.WHATSAPP_USE_TEMPLATES !== "on" || process.env.WHATSAPP_STARTED_TEMPLATE !== "v1") return;
  const already = await db.whatsAppMessage.findFirst({ where: { kind: "SERVICE_STARTED", relatedType: "Job", relatedId: jobId }, select: { id: true } });
  if (already) return;
  const job = await db.job.findFirst({ where: { id: jobId, deletedAt: null, status: "STARTED" }, select: { id: true, jobNumber: true, customerName: true, customerMobile: true, service: true } });
  if (!job) return;
  const t = templateByName("sahara_service_started_v1")!;
  const params = [job.customerName, SERVICE_LABELS[job.service] ?? job.service, job.jobNumber];
  const res = await sendWhatsAppTemplate({ kind: "SERVICE_STARTED", toNumber: job.customerMobile, toName: job.customerName, templateName: t.name, languageCode: t.language, bodyParams: params, preview: renderTemplatePreview(t, params), relatedType: "Job", relatedId: job.id });
  if (!res.sent && "error" in res && res.error && !/test mode|opt|not connected/i.test(String(res.error))) throw new Error(String(res.error));
}

/** Kill-switch for the automatic View Estimate / View Invoice messages (default on; TEST outbound mode still limits who receives them). */
const docLinksOn = () => process.env.WHATSAPP_DOC_LINKS !== "off";

/** "Here is your estimate" with the secure /booking?quote= link. Once per quotation. */
export async function sendQuotationNotice(quotationId: string) {
  if (!docLinksOn()) return;
  const already = await db.whatsAppMessage.findFirst({ where: { kind: "QUOTATION_NOTICE", relatedType: "Quotation", relatedId: quotationId }, select: { id: true } });
  if (already) return;
  const q = await db.quotation.findUnique({ where: { id: quotationId }, select: { id: true, quoteNumber: true, totalAmount: true, publicToken: true, lead: { select: { name: true, mobile: true, whatsapp: true } } } });
  if (!q?.lead) return;
  let token = q.publicToken;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await db.quotation.update({ where: { id: q.id }, data: { publicToken: token } });
  }
  const body = `Hi ${q.lead.name}, thank you for your enquiry with Sahara Cleaning Services.\n\nYour estimate ${q.quoteNumber} (${formatINR(q.totalAmount)}) is ready:\n\u{1F4C4} View Estimate: ${PUBLIC_BOOKING_URL}/booking?quote=${token}\n\nYou can choose your date and slot on the same page.`;
  const res = await sendWhatsApp({ kind: "QUOTATION_NOTICE", toNumber: q.lead.whatsapp || q.lead.mobile, toName: q.lead.name, body, relatedType: "Quotation", relatedId: q.id });
  if (!res.sent && "error" in res && res.error && !/test mode|opt|not connected/i.test(String(res.error))) throw new Error(String(res.error));
}

/**
 * sahara_job_completed_v1 (Pay Balance + Rate Us on Google buttons). Stays off until the owner has the template approved in
 * Meta AND sets WHATSAPP_USE_TEMPLATES=on + WHATSAPP_COMPLETED_TEMPLATE=v1; outbound mode (TEST by default) still decides who
 * can receive it. Returns quietly when off so the existing completion messages keep working untouched.
 */
export async function sendJobCompletedNotice(jobId: string) {
  if (process.env.WHATSAPP_USE_TEMPLATES !== "on" || process.env.WHATSAPP_COMPLETED_TEMPLATE !== "v1") return sendJobCompletedLinks(jobId);
  const already = await db.whatsAppMessage.findFirst({ where: { kind: "JOB_COMPLETED", relatedType: "Job", relatedId: jobId }, select: { id: true } });
  if (already) return;
  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null, status: "COMPLETED" },
    select: { id: true, customerName: true, customerMobile: true, service: true, jobValue: true, paymentPreference: true, advanceRequestedAt: true, payments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true } } },
  });
  if (!job) return;
  const pmt = customerPaymentStatus(job);
  const t = templateByName("sahara_job_completed_v1")!;
  const token = await ensureJobToken(job.id);
  const params = [job.customerName, SERVICE_LABELS[job.service] ?? job.service, formatINR(pmt.due).replace(/^₹\s?/, "")];
  const res = await sendWhatsAppTemplate({
    kind: "JOB_COMPLETED",
    toNumber: job.customerMobile,
    toName: job.customerName,
    templateName: t.name,
    languageCode: t.language,
    bodyParams: params,
    buttonUrlParams: [{ index: 0, value: token }], // Pay Balance → /booking/pay/{token}; the Google review button is a fixed link
    preview: renderTemplatePreview(t, params),
    relatedType: "Job",
    relatedId: job.id,
  });
  if (!res.sent && "error" in res && res.error && !/test mode|opt|not connected/i.test(String(res.error))) throw new Error(String(res.error));
}

/**
 * Plain-text completion message: View Invoice (+ Pay Balance when something is due). Used until the template is approved and on.
 * `force` (the office's "Resend Invoice Link" button) skips the once-per-job guard and the kill-switch; it never throws.
 */
export async function sendJobCompletedLinks(jobId: string, opts: { force?: boolean } = {}) {
  if (!opts.force && !docLinksOn()) return;
  if (!opts.force) {
    const already = await db.whatsAppMessage.findFirst({ where: { kind: "JOB_COMPLETED", relatedType: "Job", relatedId: jobId }, select: { id: true } });
    if (already) return;
  }
  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null, status: "COMPLETED" },
    select: { id: true, customerName: true, customerMobile: true, service: true, jobValue: true, paymentPreference: true, advanceRequestedAt: true, invoice: { select: { invoiceNumber: true } }, payments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true } } },
  });
  if (!job) return;
  const pmt = customerPaymentStatus(job);
  const token = await ensureJobToken(job.id);
  const settings = await db.companySettings.findUnique({ where: { id: "default" }, select: { googleReviewUrl: true } }).catch(() => null);
  const lines = [
    `Hi ${job.customerName}, your ${SERVICE_LABELS[job.service] ?? job.service} service is complete. Thank you for choosing Sahara Cleaning Services!`,
    ``,
    `\u{1F9FE} View Invoice${job.invoice ? ` ${job.invoice.invoiceNumber}` : ""}: ${PUBLIC_BOOKING_URL}/booking/invoice/${token}`,
    pmt.due > 0 ? `\u{1F4B3} Balance due ${formatINR(pmt.due)} — pay online: ${PUBLIC_BOOKING_URL}/booking/pay/${token}` : `Payment received in full — thank you.`,
    ...(settings?.googleReviewUrl ? [``, `\u2B50 Happy with our service? Please rate us on Google: ${settings.googleReviewUrl}`] : []),
  ];
  const res = await sendWhatsApp({ kind: "JOB_COMPLETED", toNumber: job.customerMobile, toName: job.customerName, body: lines.join("\n"), relatedType: "Job", relatedId: job.id });
  if (opts.force) return res;
  if (!res.sent && "error" in res && res.error && !/test mode|opt|not connected/i.test(String(res.error))) throw new Error(String(res.error));
}

/** Called every minute by the scheduler (src/instrumentation.ts). */
export const runQueueSweep = () =>
  runDueJobs({
    TEAM_DISPATCH: async (p) => void (await dispatchTeamForJob(String(p.jobId))),
    JOB_COMPLETED_NOTICE: async (p) => void (await sendJobCompletedNotice(String(p.jobId))),
    QUOTATION_NOTICE: async (p) => sendQuotationNotice(String(p.quotationId)),
    SERVICE_STARTED_NOTICE: async (p) => sendServiceStartedNotice(String(p.jobId)),
  });
