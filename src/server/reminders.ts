// Automated WhatsApp sweeps — customer job reminders, payment reminders and
// AMC renewal reminders. Called from /api/cron/reminders (see that route for
// the schedule + auth) and safe to call repeatedly: each sweep checks
// WhatsAppMessage/lastReminderAt before sending again, so nothing gets
// double-reminded.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  customerReminderMessage,
  paymentReminderWhatsAppMessage,
  amcRenewalMessage,
  reviewRequestMessage,
  reviewReminderMessage,
} from "@/lib/whatsapp-templates";
import { computePaymentStatus } from "@/lib/payment-status";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Reminds customers whose job is scheduled for tomorrow, once per job. */
export async function sweepCustomerReminders() {
  const tomorrowStart = addDays(startOfDay(new Date()), 1);
  const tomorrowEnd = addDays(tomorrowStart, 1);

  const jobs = await db.job.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ASSIGNED", "ON_THE_WAY"] },
      scheduledDate: { gte: tomorrowStart, lt: tomorrowEnd },
    },
  });

  let sent = 0;
  for (const job of jobs) {
    const already = await db.whatsAppMessage.findFirst({
      where: { kind: "CUSTOMER_REMINDER", relatedType: "Job", relatedId: job.id },
    });
    if (already) continue;
    await sendWhatsApp({
      kind: "CUSTOMER_REMINDER",
      toNumber: job.customerMobile,
      toName: job.customerName,
      body: customerReminderMessage({
        customerName: job.customerName,
        service: SERVICE_LABELS[job.service] ?? job.service,
        date: job.scheduledDate,
        timeSlot: job.scheduledTime,
      }),
      relatedType: "Job",
      relatedId: job.id,
    });
    sent += 1;
  }
  return { sent, checked: jobs.length };
}

/** Reminds customers with a due-soon/overdue balance, at most once every 3 days per invoice. */
export async function sweepPaymentReminders() {
  const payments = await db.payment.findMany({
    where: { deletedAt: null, status: { not: "PAID" }, clientMobile: { not: null } },
  });

  let sent = 0;
  const cutoff = addDays(new Date(), -3);
  for (const p of payments) {
    const status = computePaymentStatus(p.dueDate, p.status);
    if (status === "PENDING" || status === "PAID") continue;
    if (p.lastReminderAt && p.lastReminderAt > cutoff) continue;

    const balance = Math.max(p.amount - p.paidAmount, 0);
    if (balance <= 0) continue;

    const res = await sendWhatsApp({
      kind: "PAYMENT_REMINDER",
      toNumber: p.clientMobile!,
      toName: p.clientName,
      body: paymentReminderWhatsAppMessage({
        clientName: p.clientName,
        invoiceNumber: p.invoiceNumber,
        balance,
        dueDate: p.dueDate,
      }),
      relatedType: "Payment",
      relatedId: p.id,
    });
    await db.payment.update({ where: { id: p.id }, data: { lastReminderAt: new Date(), lastReminderChannel: "WHATSAPP" } });
    if (res.sent || res.queued) sent += 1;
  }
  return { sent, checked: payments.length };
}

/**
 * AMC renewal / service reminders at 30, 7 and 1 day before the due date
 * (contractExpiryDate → renewal, else serviceReminderDate / nextVisitDate →
 * service visit). One reminder per contract per tier, WhatsApp + SMS.
 */
export async function sweepAmcRenewalReminders() {
  const { sendSMS } = await import("@/lib/sms");
  const now = new Date();
  const TIERS = [30, 7, 1];
  const contracts = await db.amcContract.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
  });

  let sent = 0;
  for (const c of contracts) {
    const dueDate = c.contractExpiryDate ?? c.serviceReminderDate ?? c.nextVisitDate;
    if (!dueDate) continue;
    const daysLeft = Math.round((startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / 86400000);
    const tier = TIERS.find((t) => daysLeft <= t && daysLeft >= t - 1 && daysLeft >= 0);
    if (tier == null) continue;

    const marker = `AMC_T${tier}`;
    const already = await db.whatsAppMessage.findFirst({
      where: { kind: "AMC_RENEWAL", relatedType: "AmcContract", relatedId: c.id, body: { contains: marker } },
    });
    if (already) continue;

    const body =
      `${marker} ` +
      amcRenewalMessage({ customerName: c.customerName, nextVisitDate: dueDate, frequency: c.frequency }) +
      (daysLeft <= 1 ? " (due tomorrow)" : ` (${daysLeft} days left)`);

    await sendWhatsApp({
      kind: "AMC_RENEWAL",
      toNumber: c.customerMobile,
      toName: c.customerName,
      body,
      relatedType: "AmcContract",
      relatedId: c.id,
    }).catch(() => {});
    await sendSMS({
      kind: "REMINDER",
      toNumber: c.customerMobile,
      toName: c.customerName,
      body,
      relatedType: "AmcContract",
      relatedId: c.id,
    }).catch(() => {});
    sent += 1;
  }
  return { sent, checked: contracts.length };
}

/** Fires an in-app + push notification for every follow-up that has come due
 * today and hasn't been notified in the last 20 hours. */
export async function sweepDueFollowUpNotifications() {
  const { notify } = await import("@/server/notify");
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const due = await db.followUp.findMany({
    where: { isDone: false, dueDate: { lte: end }, lead: { deletedAt: null } },
    include: { lead: { select: { id: true, name: true, mobile: true } } },
    orderBy: { dueDate: "asc" },
    take: 50,
  });
  const since = new Date(Date.now() - 20 * 3600 * 1000);
  let sent = 0;
  for (const f of due) {
    const already = await db.notification.count({
      where: { kind: "FOLLOWUP_DUE", createdAt: { gte: since }, meta: { contains: f.id } },
    });
    if (already) continue;
    await notify({
      kind: "FOLLOWUP_DUE",
      title: `Follow-up due — ${f.lead.name}`,
      body: `${f.notes || "Follow-up"}${f.lead.mobile ? ` · ☎ ${f.lead.mobile}` : ""}`,
      href: `/leads/${f.lead.id}`,
      meta: { followUpId: f.id },
    });
    sent += 1;
  }
  return { sent, checked: due.length };
}

/**
 * Stale-lead alert — an open-pipeline lead (not yet CONFIRMED/JOB_SCHEDULED/
 * CANCELLED/COMPLETED) with no update in 5+ days. Reuses the exact criteria
 * already computed for the Owner Command Center's alert list
 * (src/server/owner-command-center.ts getOwnerAlerts), just also pushed as a
 * Notification/web-push so Shoaib/Francis see it without opening the
 * dashboard, not only Admin.
 */
export async function sweepStaleLeadNotifications() {
  const { notify } = await import("@/server/notify");
  const staleThreshold = addDays(new Date(), -5);
  const staleLeads = await db.lead.findMany({
    where: {
      deletedAt: null,
      stage: { in: ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] },
      updatedAt: { lt: staleThreshold },
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: { id: true, name: true, mobile: true, updatedAt: true },
  });

  const since = new Date(Date.now() - 20 * 3600 * 1000);
  let sent = 0;
  for (const lead of staleLeads) {
    const already = await db.notification.count({
      where: { kind: "STALE_LEAD", createdAt: { gte: since }, meta: { contains: lead.id } },
    });
    if (already) continue;
    await notify({
      kind: "STALE_LEAD",
      title: `Stale lead — ${lead.name}`,
      body: `No update in 5+ days${lead.mobile ? ` · ☎ ${lead.mobile}` : ""}`,
      href: `/leads/${lead.id}`,
      meta: { leadId: lead.id },
    });
    sent += 1;
  }
  return { sent, checked: staleLeads.length };
}

/**
 * Review campaign: Day 1 "Google review please" and Day 3 gentle reminder
 * after a job is completed. The sequence STOPS the moment a Review row exists
 * for that customer (dated after the job completed) — never nags a customer
 * who has already reviewed. WhatsApp + SMS, one message per tier per job.
 */
export async function sweepReviewCampaign() {
  const { sendSMS } = await import("@/lib/sms");
  const now = new Date();
  const windowStart = addDays(startOfDay(now), -4);

  const jobs = await db.job.findMany({
    where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: windowStart, lte: now } },
  });
  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  const reviewUrl = settings?.googleReviewUrl ?? null;

  let sent = 0;
  for (const job of jobs) {
    if (!job.completedAt) continue;
    const daysSince = Math.floor((startOfDay(now).getTime() - startOfDay(job.completedAt).getTime()) / 86400000);
    const tier = daysSince === 1 ? "D1" : daysSince === 3 ? "D3" : null;
    if (!tier) continue;

    // Stop the sequence once the customer has left a review.
    const reviewed = await db.review.findFirst({
      where: { customerMobile: job.customerMobile, createdAt: { gte: job.completedAt } },
    });
    if (reviewed) continue;

    const marker = `RC_${tier}`;
    const already = await db.whatsAppMessage.findFirst({
      where: { kind: "REVIEW_CAMPAIGN", relatedType: "Job", relatedId: job.id, body: { contains: marker } },
    });
    if (already) continue;

    const body =
      `${marker} ` +
      (tier === "D1"
        ? reviewRequestMessage({
            customerName: job.customerName,
            service: SERVICE_LABELS[job.service] ?? job.service,
            googleReviewUrl: reviewUrl,
            jobNumber: job.jobNumber,
          })
        : reviewReminderMessage({ customerName: job.customerName, googleReviewUrl: reviewUrl }));

    await sendWhatsApp({
      kind: "REVIEW_CAMPAIGN",
      toNumber: job.customerMobile,
      toName: job.customerName,
      body,
      relatedType: "Job",
      relatedId: job.id,
    }).catch(() => {});
    await sendSMS({
      kind: "REVIEW",
      toNumber: job.customerMobile,
      toName: job.customerName,
      body,
      relatedType: "Job",
      relatedId: job.id,
    }).catch(() => {});
    sent += 1;
  }
  return { sent, checked: jobs.length };
}

/**
 * Automatic review request ~2 hours after a payment is fully collected — for
 * jobs where the completion-time review request never went out (e.g. payment
 * collected later). One per job; skipped if the customer already reviewed.
 */
export async function sweepPostPaymentReview() {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 3600 * 1000);
  const until = new Date(now.getTime() - 2 * 3600 * 1000);

  const payments = await db.payment.findMany({
    where: { deletedAt: null, status: "PAID", jobId: { not: null }, paidDate: { gte: from, lte: until } },
  });

  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  const reviewUrl = settings?.googleReviewUrl ?? null;

  let sent = 0;
  for (const p of payments) {
    if (!p.jobId) continue;
    const already = await db.whatsAppMessage.findFirst({
      where: { kind: { in: ["REVIEW_REQUEST", "REVIEW_CAMPAIGN"] }, relatedType: "Job", relatedId: p.jobId },
    });
    if (already) continue;

    const job = await db.job.findUnique({ where: { id: p.jobId } });
    // Only after the service is done — an advance paid before the visit must
    // never trigger a review request.
    if (!job || job.deletedAt || job.status !== "COMPLETED") continue;

    const reviewed = await db.review.findFirst({
      where: { customerMobile: job.customerMobile, createdAt: { gte: p.paidDate ?? from } },
    });
    if (reviewed) continue;

    await sendWhatsApp({
      kind: "REVIEW_REQUEST",
      toNumber: job.customerMobile,
      toName: job.customerName,
      body: reviewRequestMessage({
        customerName: job.customerName,
        service: SERVICE_LABELS[job.service] ?? job.service,
        googleReviewUrl: reviewUrl,
        jobNumber: job.jobNumber,
      }),
      relatedType: "Job",
      relatedId: job.id,
    }).catch(() => {});
    sent += 1;
  }
  return { sent, checked: payments.length };
}

export async function runAllReminderSweeps() {
  const [customer, payment, amc, followUps, staleLeads, reviewCampaign, postPaymentReview] = await Promise.all([
    sweepCustomerReminders(),
    sweepPaymentReminders(),
    sweepAmcRenewalReminders(),
    sweepDueFollowUpNotifications(),
    sweepStaleLeadNotifications(),
    sweepReviewCampaign(),
    sweepPostPaymentReview(),
  ]);
  return { customer, payment, amc, followUps, staleLeads, reviewCampaign, postPaymentReview };
}
