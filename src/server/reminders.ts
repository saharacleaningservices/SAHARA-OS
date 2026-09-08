// Automated WhatsApp sweeps — customer job reminders, payment reminders and
// AMC renewal reminders. Called from /api/cron/reminders (see that route for
// the schedule + auth) and safe to call repeatedly: each sweep checks
// WhatsAppMessage/lastReminderAt before sending again, so nothing gets
// double-reminded.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { customerReminderMessage, paymentReminderWhatsAppMessage, amcRenewalMessage } from "@/lib/whatsapp-templates";
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

/** Reminds customers whose AMC next-visit date is within 3 days, once per due cycle. */
export async function sweepAmcRenewalReminders() {
  const soon = addDays(new Date(), 3);
  const contracts = await db.amcContract.findMany({
    where: { deletedAt: null, status: "ACTIVE", nextVisitDate: { lte: soon } },
  });

  let sent = 0;
  for (const c of contracts) {
    const already = await db.whatsAppMessage.findFirst({
      where: {
        kind: "AMC_RENEWAL",
        relatedType: "AmcContract",
        relatedId: c.id,
        createdAt: { gte: addDays(new Date(), -7) },
      },
    });
    if (already) continue;
    await sendWhatsApp({
      kind: "AMC_RENEWAL",
      toNumber: c.customerMobile,
      toName: c.customerName,
      body: amcRenewalMessage({ customerName: c.customerName, nextVisitDate: c.nextVisitDate, frequency: c.frequency }),
      relatedType: "AmcContract",
      relatedId: c.id,
    });
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

export async function runAllReminderSweeps() {
  const [customer, payment, amc, followUps] = await Promise.all([
    sweepCustomerReminders(),
    sweepPaymentReminders(),
    sweepAmcRenewalReminders(),
    sweepDueFollowUpNotifications(),
  ]);
  return { customer, payment, amc, followUps };
}
