// What the background queue runs. Not a "use server" module: nothing here is callable from the browser.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { dispatchTeamForJob } from "@/server/dispatch";
import { customerPaymentStatus, ensureJobToken } from "@/server/booking-messages";
import { enqueueJob, runDueJobs } from "@/server/job-queue";

/** Crew dispatch for a job, in the background. One unfinished dispatch per job at a time. */
export const enqueueTeamDispatch = (jobId: string) => enqueueJob("TEAM_DISPATCH", { jobId }, { dedupeKey: `dispatch:${jobId}` });

/** "Job completed" customer notice with the Pay Balance link, in the background. Sent at most once per job. */
export const enqueueJobCompletedNotice = (jobId: string) => enqueueJob("JOB_COMPLETED_NOTICE", { jobId }, { dedupeKey: `completed:${jobId}` });

/**
 * sahara_job_completed_v1 (Pay Balance + Rate Us on Google buttons). Stays off until the owner has the template approved in
 * Meta AND sets WHATSAPP_USE_TEMPLATES=on + WHATSAPP_COMPLETED_TEMPLATE=v1; outbound mode (TEST by default) still decides who
 * can receive it. Returns quietly when off so the existing completion messages keep working untouched.
 */
export async function sendJobCompletedNotice(jobId: string) {
  if (process.env.WHATSAPP_USE_TEMPLATES !== "on" || process.env.WHATSAPP_COMPLETED_TEMPLATE !== "v1") return;
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
  if (!res.sent && "error" in res && res.error && !/test mode|opt/i.test(String(res.error))) throw new Error(String(res.error));
}

/** Called every minute by the scheduler (src/instrumentation.ts). */
export const runQueueSweep = () =>
  runDueJobs({
    TEAM_DISPATCH: async (p) => void (await dispatchTeamForJob(String(p.jobId))),
    JOB_COMPLETED_NOTICE: async (p) => sendJobCompletedNotice(String(p.jobId)),
  });
