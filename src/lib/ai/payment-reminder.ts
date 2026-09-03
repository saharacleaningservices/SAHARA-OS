// Local, deterministic payment-reminder drafting. Tone escalates purely from
// how many days past due the invoice is — no external AI call, no guesswork.
import { COMPANY } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { pendingDays } from "@/lib/payment-status";

export type ReminderTone = "friendly" | "firm" | "urgent";

export type PaymentReminderDraft = {
  tone: ReminderTone;
  days: number;
  balance: number;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
};

export function draftPaymentReminder(payment: {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
}): PaymentReminderDraft {
  const days = pendingDays(payment.dueDate);
  const balance = Math.max(payment.amount - payment.paidAmount, 0);

  let tone: ReminderTone = "friendly";
  let opening: string;
  if (days <= 0) {
    tone = "friendly";
    opening = `this is a friendly reminder that invoice ${payment.invoiceNumber} of ${formatINR(balance)} is due on ${formatDate(payment.dueDate)}.`;
  } else if (days <= 7) {
    tone = "firm";
    opening = `invoice ${payment.invoiceNumber} of ${formatINR(balance)} was due on ${formatDate(payment.dueDate)} (${days} day${days === 1 ? "" : "s"} ago). Kindly clear it at the earliest.`;
  } else {
    tone = "urgent";
    opening = `invoice ${payment.invoiceNumber} of ${formatINR(balance)} is now ${days} days overdue (was due ${formatDate(payment.dueDate)}). Please arrange payment urgently to avoid any disruption in service.`;
  }

  const whatsappMessage = `Hi ${payment.clientName}, ${opening} — ${COMPANY.name}. Call us on ${COMPANY.phones[0]} for any queries. Thank you!`;
  const emailSubject = `Payment ${tone === "urgent" ? "overdue" : "reminder"} — Invoice ${payment.invoiceNumber}`;
  const emailBody = `Dear ${payment.clientName},\n\nThis is to let you know that ${opening}\n\nRegards,\n${COMPANY.name}\n${COMPANY.phones.join(" / ")}\n${COMPANY.website}`;

  return { tone, days, balance, whatsappMessage, emailSubject, emailBody };
}
