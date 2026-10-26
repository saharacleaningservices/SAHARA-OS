import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { formatDate } from "@/lib/utils";
import { ensureShortCode, shortUrl } from "@/server/short-links";
import { WHATSAPP_TRANSACTIONAL_TEMPLATES, sendWhatsApp, sendWhatsAppTemplate, shouldFallBackToText } from "@/lib/whatsapp";
import { premiumBookingConfirmationMessage } from "@/lib/whatsapp-templates";
import { compactServiceLines } from "@/lib/service-scope";
import { BOOKING_HEADER_IMAGE, GOOGLE_REVIEW_URL, renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";

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
// WHATSAPP_BOOKING_TEMPLATE=v2 → sahara_booking_confirmed_v2 (View Quotation + Payment Options
// path routes). Anything else keeps the approved v1 sahara_booking_confirmed unchanged.
// v2 is used only once it is on the approved transactional list — Meta has no
// approved sahara_booking_confirmed_v2 (checked 2026-10-08), so until then the
// approved sahara_booking_confirmed (View Booking · Pay Advance · Pay After
// Service · Google Review) is sent even if WHATSAPP_BOOKING_TEMPLATE=v2 is set.
const bookingTemplateV2 = () =>
  process.env.WHATSAPP_BOOKING_TEMPLATE === "v2" && WHATSAPP_TRANSACTIONAL_TEMPLATES.includes("sahara_booking_confirmed_v2");
// WHATSAPP_BOOKING_TEMPLATE=v3 → sahara_booking_confirmed_v3 (View Quotation · Pay Now / Later ·
// Google Review). Set it in Coolify only AFTER Meta shows the template as Approved.
const bookingTemplateV3 = () => process.env.WHATSAPP_BOOKING_TEMPLATE === "v3";
// WHATSAPP_BOOKING_TEMPLATE=v4 → sahara_booking_confirmed_v4: the same two buttons plus the Google review link in the
// message text, so all three actions arrive in ONE message (owner Phase 2). Set only after Meta approves v4.
const bookingTemplateV4 = () => process.env.WHATSAPP_BOOKING_TEMPLATE === "v4";
// WHATSAPP_BOOKING_TEMPLATE=v5 → sahara_booking_confirmed_v5 (utility): image header, same two buttons, no review link.
const bookingTemplateV5 = () => process.env.WHATSAPP_BOOKING_TEMPLATE === "v5";
// WHATSAPP_BOOKING_TEMPLATE=v6 → sahara_booking_confirmed_v6: View Quotation (A4 PDF) + Pay Advance on short links, nothing else.
const bookingTemplateV6 = () => process.env.WHATSAPP_BOOKING_TEMPLATE === "v6";

/** Body parameters for sahara_booking_confirmed_v4 (exported for tests). */
export function bookingConfirmationV4Params(job: { customerName: string; jobNumber: string; scheduledDate: Date; scheduledTime: string; area: string }, service: string, reviewUrl: string | null | undefined) {
  return [job.customerName, job.jobNumber, service, formatDate(job.scheduledDate), job.scheduledTime, job.area, reviewUrl?.trim() || GOOGLE_REVIEW_URL];
}

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
// Two confirmations of the same job arriving together (double click, confirmBooking + createJob racing) share ONE send:
// the database check below runs before the message row exists, so on its own it could let both through.
const inFlight = new Map<string, Promise<unknown>>();

export function sendBookingConfirmation(jobId: string) {
  const running = inFlight.get(jobId);
  if (running) return running as ReturnType<typeof sendBookingConfirmationOnce>;
  const p = sendBookingConfirmationOnce(jobId).finally(() => inFlight.delete(jobId));
  inFlight.set(jobId, p);
  return p;
}

async function sendBookingConfirmationOnce(jobId: string) {
  const already = await db.whatsAppMessage.findFirst({
    where: { kind: "BOOKING_CONFIRMATION", relatedType: "Job", relatedId: jobId },
    select: { id: true },
  });
  if (already) return { skipped: "already-confirmed" as const };

  const job = await db.job.findUnique({ where: { id: jobId }, include: { payments: { where: { deletedAt: null } } } });
  if (!job || job.deletedAt || job.isDemo || job.status === "CANCELLED") return { skipped: "not-confirmable" as const };

  const token = await ensureJobToken(job.id);
  const code = await ensureShortCode(job.id);
  const url = bookingPageUrl(token);
  const links = { booking: shortUrl("b", code), quotation: shortUrl("q", code), pay: shortUrl("p", code) }; // short links in the text message (owner 2026-10-24)
  const service = SERVICE_LABELS[job.service] ?? job.service;
  const { due } = customerPaymentStatus(job);
  // The confirmation carries the Pay Advance action, so an advance now counts
  // as requested (unless the customer already chose to pay after service).
  if (due > 0 && !job.advanceRequestedAt && job.paymentPreference !== "PAY_AFTER_SERVICE") {
    await db.job.update({ where: { id: job.id }, data: { advanceRequestedAt: new Date() } });
  }

  // Plain-text confirmation: the last branch, and the fallback when a template send definitely did not go out (rejected / paused /
  // unapproved template, HTTP error, unreachable). A timeout is NOT a fallback case — the template may still have been delivered.
  const sendText = async () => {
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
        links,
        serviceSummary: compactServiceLines(job).join(", ") || null,
        total: job.jobValue,
        paid: job.payments.reduce((s, p) => s + (p.paidAmount ?? 0), 0),
      }),
      relatedType: "Job",
      relatedId: job.id,
    });
  };
  const viaTemplate = async (input: Parameters<typeof sendWhatsAppTemplate>[0]) => {
    const r = await sendWhatsAppTemplate(input);
    if (!r.sent && "error" in r && shouldFallBackToText(r.error)) return sendText();
    return r;
  };

  if (templatesEnabled() && bookingTemplateV6()) {
    const t = templateByName("sahara_booking_confirmed_v6")!;
    const params = bookingConfirmationV4Params(job, service, null).slice(0, 6);
    return viaTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      headerImageUrl: BOOKING_HEADER_IMAGE,
      // The short code, not the long booking token: /q/{{1}} and /p/{{1}}.
      buttonUrlParams: [
        { index: 0, value: code },
        { index: 1, value: code },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  if (templatesEnabled() && bookingTemplateV5()) {
    const t = templateByName("sahara_booking_confirmed_v5")!;
    const params = bookingConfirmationV4Params(job, service, null).slice(0, 6);
    return viaTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      headerImageUrl: BOOKING_HEADER_IMAGE,
      buttonUrlParams: [
        { index: 0, value: token },
        { index: 1, value: token },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  if (templatesEnabled() && bookingTemplateV4()) {
    const t = templateByName("sahara_booking_confirmed_v4")!;
    const settings = await db.companySettings.findUnique({ where: { id: "default" }, select: { googleReviewUrl: true } });
    const params = bookingConfirmationV4Params(job, service, settings?.googleReviewUrl);
    return viaTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      // Plain token only — /booking/quotation/{{1}} and /booking/pay/{{1}}; the review link is body parameter 7.
      buttonUrlParams: [
        { index: 0, value: token },
        { index: 1, value: token },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  if (templatesEnabled() && bookingTemplateV3()) {
    const t = templateByName("sahara_booking_confirmed_v3")!;
    const params = [job.customerName, job.jobNumber, service, formatDate(job.scheduledDate), job.scheduledTime, job.area];
    return viaTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      // Plain token only — /booking/quotation/{{1}} and /booking/pay/{{1}}; button 3 is a Quick Reply.
      buttonUrlParams: [
        { index: 0, value: token },
        { index: 1, value: token },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  if (templatesEnabled() && bookingTemplateV2()) {
    const t = templateByName("sahara_booking_confirmed_v2")!;
    const params = [job.customerName, job.jobNumber, service, formatDate(job.scheduledDate), job.scheduledTime, job.area];
    return viaTemplate({
      kind: "BOOKING_CONFIRMATION",
      toNumber: job.customerMobile,
      toName: job.customerName,
      templateName: t.name,
      languageCode: t.language,
      bodyParams: params,
      // Plain token only — the template URLs are /booking/quotation/{{1}} and /booking/pay/{{1}}.
      buttonUrlParams: [
        { index: 0, value: token },
        { index: 1, value: token },
      ],
      preview: renderTemplatePreview(t, params),
      relatedType: "Job",
      relatedId: job.id,
    });
  }

  if (templatesEnabled()) {
    const t = templateByName("sahara_booking_confirmed")!;
    const params = [job.customerName, job.jobNumber, service, formatDate(job.scheduledDate), job.scheduledTime, job.area];
    return viaTemplate({
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

  return sendText();
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
