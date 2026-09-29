import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { formatDate } from "@/lib/utils";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { premiumBookingConfirmationMessage } from "@/lib/whatsapp-templates";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";

// One booking-message pipeline for every confirmed booking — online requests
// confirmed from a lead (confirmBooking) and jobs entered manually in the CRM
// (createJob) both call sendBookingConfirmation(), so customers always get the
// same message and the duplicate guard is shared.
//
// WHATSAPP_USE_TEMPLATES=on switches customer booking messages to the approved
// Cloud API templates in whatsapp-cloud-templates.ts (required outside the
// 24-hour service window). Until then the existing plain-text message is used
// and simply queues while the API isn't connected.

const templatesEnabled = () => process.env.WHATSAPP_USE_TEMPLATES === "on";

/** Returns the job's unguessable booking-page token, creating it on first use. */
export async function ensureJobToken(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { publicToken: true } });
  if (job?.publicToken) return job.publicToken;
  const token = randomBytes(18).toString("base64url");
  await db.job.update({ where: { id: jobId }, data: { publicToken: token } });
  return token;
}

export const bookingPageUrl = (token: string) => `${PUBLIC_BOOKING_URL}/booking/${token}`;

export type CustomerPaymentStatus = "UNPAID" | "ADVANCE_REQUESTED" | "ADVANCE_PAID" | "PAY_AFTER_SERVICE" | "FULLY_PAID";

export const PAYMENT_STATUS_LABEL: Record<CustomerPaymentStatus, string> = {
  UNPAID: "Unpaid",
  ADVANCE_REQUESTED: "Advance requested",
  ADVANCE_PAID: "Advance paid",
  PAY_AFTER_SERVICE: "Pay after service",
  FULLY_PAID: "Fully paid",
};

/**
 * Customer-facing payment status, derived only from payments staff have
 * actually recorded — nothing is ever marked paid automatically. (Refunds
 * aren't tracked in Sahara OS yet, so REFUNDED isn't derived.)
 */
export function customerPaymentStatus(job: {
  jobValue: number;
  paymentPreference: string | null;
  advanceRequestedAt: Date | null;
  payments: { amount: number; paidAmount: number | null }[];
}): { status: CustomerPaymentStatus; paid: number; due: number } {
  const billed = job.payments.reduce((s, p) => s + p.amount, 0) || job.jobValue;
  const paid = job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const due = Math.max(billed - paid, 0);
  if (billed > 0 && paid >= billed) return { status: "FULLY_PAID", paid, due: 0 };
  if (paid > 0) return { status: "ADVANCE_PAID", paid, due };
  if (job.paymentPreference === "PAY_AFTER_SERVICE") return { status: "PAY_AFTER_SERVICE", paid, due };
  if (job.advanceRequestedAt) return { status: "ADVANCE_REQUESTED", paid, due };
  return { status: "UNPAID", paid, due };
}

/**
 * Sends the booking confirmation for a job exactly once. A job that already
 * has a BOOKING_CONFIRMATION message (sent, queued, failed or cancelled) is
 * never confirmed again, so re-saving a confirmed booking can't duplicate it.
 */
export async function sendBookingConfirmation(jobId: string) {
  const already = await db.whatsAppMessage.findFirst({
    where: { kind: "BOOKING_CONFIRMATION", relatedType: "Job", relatedId: jobId },
    select: { id: true },
  });
  if (already) return { skipped: "already-confirmed" as const };

  const job = await db.job.findUnique({ where: { id: jobId }, include: { payments: true } });
  if (!job || job.deletedAt || job.isDemo || job.status === "CANCELLED") return { skipped: "not-confirmable" as const };

  const token = await ensureJobToken(job.id);
  const url = bookingPageUrl(token);
  const service = SERVICE_LABELS[job.service] ?? job.service;
  const { due } = customerPaymentStatus(job);
  // The confirmation carries the Pay Advance action, so an advance now counts
  // as requested (unless the customer already chose to pay after service).
  if (due > 0 && !job.advanceRequestedAt && job.paymentPreference !== "PAY_AFTER_SERVICE") {
    await db.job.update({ where: { id: job.id }, data: { advanceRequestedAt: new Date() } });
  }

  if (templatesEnabled()) {
    const t = templateByName("sahara_booking_confirmed")!;
    const params = [job.customerName, job.jobNumber, service, formatDate(job.scheduledDate), job.scheduledTime, job.area];
    return sendWhatsAppTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      buttonUrlParams: [
        { index: 0, value: token },
        { index: 1, value: `${token}?pay=advance` },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  return sendWhatsApp({
    kind: "BOOKING_CONFIRMATION",
    toNumber: job.customerMobile,
    toName: job.customerName,
    body: premiumBookingConfirmationMessage({
      customerName: job.customerName,
      jobNumber: job.jobNumber,
      service,
      date: job.scheduledDate,
      timeSlot: job.scheduledTime,
      address: job.address,
      area: job.area,
      balanceDue: due,
      googleReviewUrl: settings?.googleReviewUrl ?? null,
      bookingUrl: url,
    }),
    relatedType: "Job",
    relatedId: job.id,
  });
}

/**
 * Optional customer notice when a confirmed booking is rescheduled or
 * cancelled. Off unless WHATSAPP_BOOKING_CHANGE_NOTICES=on, and only once per
 * change (the new date/time is part of the dedupe key).
 */
export async function sendBookingChangeNotice(jobId: string, change: "RESCHEDULED" | "CANCELLED") {
  if (process.env.WHATSAPP_BOOKING_CHANGE_NOTICES !== "on") return { skipped: "disabled" as const };
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.isDemo) return { skipped: "not-found" as const };
  const confirmed = await db.whatsAppMessage.findFirst({
    where: { kind: "BOOKING_CONFIRMATION", relatedType: "Job", relatedId: jobId, status: { in: ["SENT", "QUEUED"] } },
  });
  if (!confirmed) return { skipped: "never-confirmed" as const };

  const service = SERVICE_LABELS[job.service] ?? job.service;
  const when = formatDate(job.scheduledDate);
  const marker = change === "RESCHEDULED" ? `${when} ${job.scheduledTime}` : "cancelled";
  const dup = await db.whatsAppMessage.findFirst({
    where: { kind: "OTHER", relatedType: "Job", relatedId: jobId, body: { contains: marker }, templateName: { not: null } },
  });
  if (dup) return { skipped: "duplicate" as const };

  const token = await ensureJobToken(job.id);
  const t = templateByName(change === "RESCHEDULED" ? "sahara_booking_rescheduled" : "sahara_booking_cancelled")!;
  const params =
    change === "RESCHEDULED"
      ? [job.customerName, job.jobNumber, service, when, job.scheduledTime]
      : [job.customerName, job.jobNumber, service, when];
  return sendWhatsAppTemplate({
    kind: "OTHER",
    toNumber: job.customerMobile,
    toName: job.customerName,
    templateName: t.name,
    languageCode: t.language,
    bodyParams: params,
    buttonUrlParams: change === "RESCHEDULED" ? [{ index: 0, value: token }] : [],
    preview: `${renderTemplatePreview(t, params)} [${marker}]`,
    relatedType: "Job",
    relatedId: job.id,
  });
}
