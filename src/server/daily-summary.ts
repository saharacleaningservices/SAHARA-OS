import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { COMPANY } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { dailyBusinessSummaryMessage } from "@/lib/whatsapp-templates";

/**
 * Requirement: Shoaib's daily report — previous day's jobs, completed jobs,
 * new enquiries, converted leads, follow-ups pending today, payments
 * received, pending collection, reviews received, quotations awaiting
 * follow-up. Defaults to yesterday, matching the once-a-day morning send.
 */
export async function getDailyBusinessSummary(forDate: Date = subDays(new Date(), 1)) {
  const dayStart = startOfDay(forDate);
  const dayEnd = endOfDay(forDate);
  const todayEnd = endOfDay(new Date());

  const [
    jobsScheduled,
    jobsCompleted,
    newEnquiries,
    convertedLeads,
    followUpsPending,
    paymentsReceivedAgg,
    pendingPaymentsAgg,
    reviewsReceived,
    quotationsPending,
  ] = await Promise.all([
    db.job.count({ where: { deletedAt: null, scheduledDate: { gte: dayStart, lte: dayEnd } } }),
    db.job.count({ where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: dayStart, lte: dayEnd } } }),
    db.lead.count({ where: { deletedAt: null, createdAt: { gte: dayStart, lte: dayEnd } } }),
    // No stage-change timestamp exists — approximated as leads already past
    // the quotation stage whose record was last touched that day, same
    // proxy used for the dashboard's own conversion metrics.
    db.lead.count({
      where: {
        deletedAt: null,
        stage: { in: ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"] },
        updatedAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    db.followUp.count({ where: { isDone: false, dueDate: { lte: todayEnd }, lead: { deletedAt: null } } }),
    db.payment.aggregate({
      where: { deletedAt: null, paidDate: { gte: dayStart, lte: dayEnd } },
      _sum: { paidAmount: true },
    }),
    db.payment.aggregate({
      where: { deletedAt: null, status: { in: ["PENDING", "DUE_SOON", "OVERDUE"] } },
      _sum: { amount: true, paidAmount: true },
    }),
    db.review.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
    db.lead.count({ where: { deletedAt: null, stage: "QUOTATION" } }),
  ]);

  const pendingPaymentsTotal = (pendingPaymentsAgg._sum.amount ?? 0) - (pendingPaymentsAgg._sum.paidAmount ?? 0);

  return {
    date: forDate,
    jobsScheduled,
    jobsCompleted,
    newEnquiries,
    convertedLeads,
    followUpsPending,
    paymentsReceived: paymentsReceivedAgg._sum.paidAmount ?? 0,
    pendingPaymentsTotal,
    reviewsReceived,
    quotationsPending,
  };
}

export async function sendDailyBusinessSummary() {
  const summary = await getDailyBusinessSummary();
  const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || COMPANY.phones[0])
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const body = dailyBusinessSummaryMessage(summary);
  let sent = 0;
  for (const number of adminNumbers) {
    const res = await sendWhatsApp({ kind: "DAILY_SUMMARY", toNumber: number, body });
    if (res.sent || res.queued) sent += 1;
  }
  return { sent, summary };
}
