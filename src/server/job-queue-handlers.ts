// What the background queue runs. Not a "use server" module: nothing here is callable from the browser.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendWhatsApp, sendWhatsAppTemplate, shouldFallBackToText, WHATSAPP_TIMEOUT_ERROR_PREFIX } from "@/lib/whatsapp";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { randomBytes } from "node:crypto";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { dispatchTeamForJob } from "@/server/dispatch";
import { customerPaymentStatus, ensureJobToken } from "@/server/booking-messages";
import { enqueueJob, pruneFinishedJobs, runDueJobs } from "@/server/job-queue";

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
  const already = await db.whatsAppMessage.findFirst({ where: { kind: "SERVICE_STARTED", relatedType: "Job", relatedId: jobId, ...notFailed }, select: { id: true } });
  if (already) return;
  const job = await db.job.findFirst({ where: { id: jobId, deletedAt: null, status: "STARTED" }, select: { id: true, jobNumber: true, customerName: true, customerMobile: true, service: true } });
  if (!job) return;
  const t = templateByName("sahara_service_started_v1")!;
  const params = [job.customerName, SERVICE_LABELS[job.service] ?? job.service, job.jobNumber];
  const res = await sendWhatsAppTemplate({ kind: "SERVICE_STARTED", toNumber: job.customerMobile, toName: job.customerName, templateName: t.name, languageCode: t.language, bodyParams: params, preview: renderTemplatePreview(t, params), relatedType: "Job", relatedId: job.id });
  if (!res.sent && "error" in res && shouldFallBackToText(res.error)) {
    // The template definitely did not go out: say the same thing as plain text.
    const text = await sendWhatsApp({ kind: "SERVICE_STARTED", toNumber: job.customerMobile, toName: job.customerName, body: `Hi ${job.customerName}, our team has reached your location and started your ${params[1]} service (booking ${job.jobNumber}). We will let you know once it is complete.\n\nFor any help, call us on 7083347130 / 8956567130.`, relatedType: "Job", relatedId: job.id });
    return settle(text);
  }
  settle(res);
}

/** Kill-switch for the automatic View Estimate / View Invoice messages (default on; TEST outbound mode still limits who receives them). */
const docLinksOn = () => process.env.WHATSAPP_DOC_LINKS !== "off";

/**
 * What the queue should do with a finished send: nothing for success and for deliberate refusals (TEST mode, opt-out, no consent, not
 * connected); nothing for a TIMEOUT too — the message may have been delivered, and repeating it would send a duplicate; anything else is
 * thrown so the queue retries with back-off.
 */
function settle(res: { sent: boolean; error?: string } | undefined) {
  if (!res || res.sent || !res.error) return;
  if (res.error.startsWith(WHATSAPP_TIMEOUT_ERROR_PREFIX) || /test mode|opt|not connected|consent/i.test(res.error)) return;
  throw new Error(res.error);
}

/** A message that failed outright must not stop the next attempt (or the text fallback) from sending — only delivered / queued / blocked rows count as "already sent". */
const notFailed = { status: { not: "FAILED" } } as const;

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
  const version = process.env.WHATSAPP_COMPLETED_TEMPLATE;
  if (process.env.WHATSAPP_USE_TEMPLATES !== "on" || (version !== "v1" && version !== "v2")) return sendJobCompletedLinks(jobId);
  const already = await db.whatsAppMessage.findFirst({ where: { kind: "JOB_COMPLETED", relatedType: "Job", relatedId: jobId, ...notFailed }, select: { id: true } });
  if (already) return;
  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null, status: "COMPLETED" },
    select: { id: true, customerName: true, customerMobile: true, service: true, jobValue: true, paymentPreference: true, advanceRequestedAt: true, payments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true } } },
  });
  if (!job) return;
  const pmt = customerPaymentStatus(job);
  const t = templateByName(version === "v2" ? "sahara_job_completed_v2" : "sahara_job_completed_v1")!;
  const token = await ensureJobToken(job.id);
  const params = [job.customerName, SERVICE_LABELS[job.service] ?? job.service, formatINR(pmt.due).replace(/^₹\s?/, "")];
  const res = await sendWhatsAppTemplate({
    kind: "JOB_COMPLETED",
    toNumber: job.customerMobile,
    toName: job.customerName,
    templateName: t.name,
    languageCode: t.language,
    bodyParams: params,
    buttonUrlParams: [{ index: 0, value: token }], // v1: Pay Balance → /booking/pay/{token}; v2: View Invoice → /booking/invoice/{token}; the Google review button is a fixed link
    preview: renderTemplatePreview(t, params),
    relatedType: "Job",
    relatedId: job.id,
  });
  // Template did not go out (rejected / paused / unreachable): send the same invoice + review links as plain text. A timeout never
  // falls back (it may have been delivered); deliberate refusals (TEST mode, opt-out) never fall back either.
  if (!res.sent && "error" in res && shouldFallBackToText(res.error)) return sendJobCompletedLinks(jobId);
  settle(res);
}

/**
 * Plain-text completion message: View Invoice (+ Pay Balance when something is due). Used until the template is approved and on.
 * `force` (the office's "Resend Invoice Link" button) skips the once-per-job guard and the kill-switch; it never throws.
 */
export async function sendJobCompletedLinks(jobId: string, opts: { force?: boolean } = {}) {
  if (!opts.force && !docLinksOn()) return;
  if (!opts.force) {
    const already = await db.whatsAppMessage.findFirst({ where: { kind: "JOB_COMPLETED", relatedType: "Job", relatedId: jobId, ...notFailed }, select: { id: true } });
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
    // One invoice link only (owner 2026-10-23): the invoice page shows the balance and the payment QR, so no separate pay link here.
    pmt.due > 0 ? `Balance due: ${formatINR(pmt.due)} \u2014 payment details are on the invoice.` : `Payment received in full \u2014 thank you.`,
    ...(settings?.googleReviewUrl ? [``, `\u2B50 Happy with our service? Please rate us on Google: ${settings.googleReviewUrl}`] : []),
  ];
  const res = await sendWhatsApp({ kind: "JOB_COMPLETED", toNumber: job.customerMobile, toName: job.customerName, body: lines.join("\n"), relatedType: "Job", relatedId: job.id });
  if (opts.force) return res;
  settle(res);
}

let lastPruneAt = 0;
/** Called every minute by the scheduler (src/instrumentation.ts). Also tidies finished queue rows about once a day. */
export const runQueueSweep = async () => {
  if (Date.now() - lastPruneAt > 24 * 3_600_000) {
    lastPruneAt = Date.now();
    await pruneFinishedJobs().catch((e) => console.error("[queue] prune failed:", e));
  }
  return runDueJobs({
    TEAM_DISPATCH: async (p) => void (await dispatchTeamForJob(String(p.jobId))),
    JOB_COMPLETED_NOTICE: async (p) => void (await sendJobCompletedNotice(String(p.jobId))),
    QUOTATION_NOTICE: async (p) => sendQuotationNotice(String(p.quotationId)),
    SERVICE_STARTED_NOTICE: async (p) => sendServiceStartedNotice(String(p.jobId)),
  });
};
