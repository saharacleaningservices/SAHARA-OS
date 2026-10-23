// Lifecycle reminders (owner 2026-10-23): (1) re-booking WhatsApp reminders 6 and 12 months after a customer's last deep-cleaning
// service, (2) friendly follow-ups for overdue unpaid GST / corporate invoices. Pure rules only — no database, no network.

export type Milestone = 6 | 12;
/** How many days after the 6 / 12-month mark a missed reminder may still be sent (the sweep may not run on the exact day). */
export const REBOOK_GRACE_DAYS = 14;
/** Days a GST / corporate invoice may stay unpaid before it counts as overdue when the invoice has no due date of its own. */
export const DEFAULT_CREDIT_DAYS = 15;
/** Days between payment follow-ups, and the most that are ever sent for one invoice. */
export const PAYMENT_REPEAT_DAYS = 7;
export const PAYMENT_MAX_REMINDERS = 3;

const DAY = 24 * 3600 * 1000;
export function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + months);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x;
}

/** Which re-booking reminder is due now: 12 if inside the window after the 12-month mark, else 6 inside the window after 6 months, else null. */
export function rebookMilestone(lastService: Date, now: Date): Milestone | null {
  for (const m of [12, 6] as const) {
    const mark = addMonths(lastService, m).getTime();
    if (now.getTime() >= mark && now.getTime() < mark + REBOOK_GRACE_DAYS * DAY) return m;
  }
  return null;
}

/** "6 months" / "1 year" for the message text. */
export const milestoneLabel = (m: Milestone) => (m === 12 ? "1 year" : "6 months");

/** Only a deep-cleaning style service starts the re-booking clock (CRM jobs carry a service type; MyBillBook history only a name). */
export const isDeepCleaningName = (name: string | null | undefined) => /deep|full[\s-]*(house|home)|whole[\s-]*(house|home)/i.test(name ?? "");

export function dueDateOf(row: { dueDate: Date | null; invoiceDate: Date }, creditDays = DEFAULT_CREDIT_DAYS): Date {
  return row.dueDate ?? new Date(row.invoiceDate.getTime() + creditDays * DAY);
}

/**
 * The next follow-up number (1–3) for an overdue invoice, or null when none is due yet / all were sent.
 * First one the day after the due date, then every 7 days.
 */
export function nextPaymentReminder(due: Date, sent: { count: number; lastAt: Date | null }, now: Date): 1 | 2 | 3 | null {
  if (sent.count >= PAYMENT_MAX_REMINDERS) return null;
  if (sent.count === 0) return now.getTime() >= due.getTime() + DAY ? 1 : null;
  if (!sent.lastAt || now.getTime() < sent.lastAt.getTime() + PAYMENT_REPEAT_DAYS * DAY) return null;
  return (sent.count + 1) as 2 | 3;
}

export const rebookKey = (customerId: string, m: Milestone, lastService: Date) => `REBOOK:${customerId}:${m}:${lastService.toISOString().slice(0, 10)}`;
export const paymentKey = (invoiceKey: string, n: number) => `PAY:${invoiceKey}:${n}`;

/** IST clock hour (0–23): reminders go out in the daytime only. */
export const istHour = (now: Date) => new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCHours();
export const REMINDER_HOURS = { from: 10, to: 18 } as const;
