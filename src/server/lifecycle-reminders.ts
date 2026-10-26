// Lifecycle reminder engine (owner 2026-10-23). Not a "use server" module; the Admin entry points are in actions/lifecycle-reminders.ts.
//
// Guardrails (CLAUDE.md): template-only; nothing leaves unless WHATSAPP_REMINDERS=on AND the outbound mode lets that template reach that
// number (TEST mode = the approved test number only); re-booking is MARKETING so it goes only to recorded opt-in contacts; a number that
// opted out is never messaged; each milestone / follow-up is sent once (ReminderLog); daytime only; capped per sweep.
import { db } from "@/lib/db";
import { formatINR } from "@/lib/utils";
import { isOutboundAllowed, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { filterToMarketingOptIn, last10 } from "@/server/whatsapp-audience";
import {
  REMINDER_HOURS,
  dueDateOf,
  isDeepCleaningName,
  istHour,
  milestoneLabel,
  nextPaymentReminder,
  paymentKey,
  rebookKey,
  rebookMilestone,
  type Milestone,
} from "@/lib/lifecycle-reminders";

export const remindersEnabled = () => process.env.WHATSAPP_REMINDERS === "on";
const MAX_PER_SWEEP = 30;

export type RebookCandidate = { customerId: string; name: string; mobile: string; service: string; lastService: Date; milestone: Milestone; key: string };
export type PaymentCandidate = { invoiceKey: string; invoiceNo: string; customerId: string | null; party: string; mobile: string; remaining: number; due: Date; number: 1 | 2 | 3; key: string };

const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Customers whose last deep-cleaning service is 3 / 6 / 12 months old, with no later booking or enquiry, opted in, not yet reminded. */
export async function collectRebook(now = new Date()): Promise<RebookCandidate[]> {
  const horizon = new Date(now.getTime() - 13 * 31 * 24 * 3600 * 1000);
  const [jobs, history] = await Promise.all([
    db.job.findMany({ where: { deletedAt: null, status: "COMPLETED", service: "HOME_DEEP_CLEANING", scheduledDate: { gte: horizon, lte: now } }, select: { customerMobile: true, scheduledDate: true } }),
    db.mybillbookInvoice.findMany({ where: { customerId: { not: null }, invoiceDate: { gte: horizon, lte: now } }, select: { customerId: true, invoiceDate: true, serviceName: true, customer: { select: { mobile: true } } } }),
  ]);
  const last = new Map<string, { date: Date; service: string }>(); // by 10-digit mobile
  const note = (mobile: string | null | undefined, date: Date, service: string) => {
    const m = last10(mobile);
    if (m && (!last.get(m) || date > last.get(m)!.date)) last.set(m, { date, service });
  };
  for (const j of jobs) note(j.customerMobile, j.scheduledDate, "Home Deep Cleaning");
  for (const h of history) if (isDeepCleaningName(h.serviceName)) note(h.customer?.mobile, h.invoiceDate, h.serviceName ?? "Deep Cleaning");

  const due: { mobile: string; date: Date; service: string; milestone: Milestone }[] = [];
  for (const [mobile, v] of last) {
    const milestone = rebookMilestone(v.date, now);
    if (milestone) due.push({ mobile, ...v, milestone });
  }
  if (!due.length) return [];

  const customers = await db.customer.findMany({ where: { mobile: { in: due.map((d) => d.mobile) } }, select: { id: true, name: true, mobile: true } });
  const byMobile = new Map(customers.map((c) => [c.mobile, c]));
  const mobiles = due.map((d) => d.mobile);
  const [laterJobs, laterLeads] = await Promise.all([
    db.job.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" }, customerMobile: { in: mobiles } }, select: { customerMobile: true, scheduledDate: true } }),
    db.lead.findMany({ where: { deletedAt: null, mobile: { in: mobiles } }, select: { mobile: true, createdAt: true } }),
  ]);
  const busy = (mobile: string, since: Date) =>
    laterJobs.some((j) => last10(j.customerMobile) === mobile && j.scheduledDate > since) || laterLeads.some((l) => last10(l.mobile) === mobile && l.createdAt > since);

  const out: RebookCandidate[] = [];
  for (const d of due) {
    const c = byMobile.get(d.mobile);
    if (!c || busy(d.mobile, d.date)) continue;
    out.push({ customerId: c.id, name: c.name, mobile: d.mobile, service: d.service, lastService: d.date, milestone: d.milestone, key: rebookKey(c.id, d.milestone, d.date) });
  }
  const sent = new Set((await db.reminderLog.findMany({ where: { dedupeKey: { in: out.map((o) => o.key) }, status: "SENT" }, select: { dedupeKey: true } })).map((r) => r.dedupeKey));
  const fresh = out.filter((o) => !sent.has(o.key));
  const { allowed } = await filterToMarketingOptIn(fresh); // recorded WhatsApp opt-in only (promotional rule)
  return allowed;
}

/** Overdue unpaid GST / corporate invoices (from the MyBillBook history) whose next follow-up (1–3) is due. */
export async function collectPayments(now = new Date()): Promise<PaymentCandidate[]> {
  const rows = await db.mybillbookInvoice.findMany({
    where: { remaining: { gt: 0 }, OR: [{ gstin: { not: null } }, { dataset: "GST" }, { customer: { contactType: "CORPORATE" } }] },
    select: { invoiceKey: true, invoiceNo: true, invoiceDate: true, dueDate: true, remaining: true, contactName: true, partyMobile: true, customerId: true, customer: { select: { name: true, mobile: true } } },
  });
  if (!rows.length) return [];
  const logs = await db.reminderLog.findMany({ where: { kind: "PAYMENT", status: "SENT", dedupeKey: { startsWith: "PAY:" } }, select: { dedupeKey: true, createdAt: true } });
  const sentBy = new Map<string, { count: number; lastAt: Date | null }>();
  for (const l of logs) {
    const k = l.dedupeKey.replace(/^PAY:/, "").replace(/:\d$/, "");
    const cur = sentBy.get(k) ?? { count: 0, lastAt: null };
    sentBy.set(k, { count: cur.count + 1, lastAt: !cur.lastAt || l.createdAt > cur.lastAt ? l.createdAt : cur.lastAt });
  }
  const out: PaymentCandidate[] = [];
  for (const r of rows) {
    const mobile = last10(r.customer?.mobile) ?? last10(r.partyMobile);
    if (!mobile) continue;
    const due = dueDateOf(r);
    const n = nextPaymentReminder(due, sentBy.get(r.invoiceKey) ?? { count: 0, lastAt: null }, now);
    if (!n) continue;
    out.push({ invoiceKey: r.invoiceKey, invoiceNo: r.invoiceNo, customerId: r.customerId, party: r.customer?.name ?? r.contactName, mobile, remaining: r.remaining, due, number: n, key: paymentKey(r.invoiceKey, n) });
  }
  return out;
}

export type SweepResult = { sent: number; failed: number; blockedByMode: number; capped: number; rebookDue: number; paymentsDue: number; note: string | null };

/** One pass. `send:false` is a preview (counts only). Safe to call repeatedly — every message is deduplicated. */
export async function runLifecycleSweep(opts: { now?: Date; send: boolean; ignoreHours?: boolean } = { send: false }): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const [rebook, pay] = await Promise.all([collectRebook(now), collectPayments(now)]);
  const res: SweepResult = { sent: 0, failed: 0, blockedByMode: 0, capped: 0, rebookDue: rebook.length, paymentsDue: pay.length, note: null };
  if (!opts.send) return res;
  if (!remindersEnabled()) return { ...res, note: "WHATSAPP_REMINDERS is not on — nothing sent." };
  const h = istHour(now);
  if (!opts.ignoreHours && (h < REMINDER_HOURS.from || h >= REMINDER_HOURS.to)) return { ...res, note: "Outside reminder hours (10:00–18:00 IST)." };

  const rebookT = templateByName("sahara_rebook_reminder_v1")!;
  const payT = templateByName("sahara_payment_due_reminder_v1")!;
  let budget = MAX_PER_SWEEP;

  const deliver = async (key: string, kind: "REBOOK" | "PAYMENT", customerId: string | null, mobile: string, name: string, t: NonNullable<ReturnType<typeof templateByName>>, params: string[], relatedId: string) => {
    if (!isOutboundAllowed(mobile, { templateName: t.name })) return void (res.blockedByMode += 1); // mode says no: leave it for later, do not record
    if (budget <= 0) return void (res.capped += 1);
    budget -= 1;
    const r = await sendWhatsAppTemplate({ kind: "CUSTOMER_REMINDER", toNumber: mobile, toName: name, templateName: t.name, languageCode: t.language, bodyParams: params, preview: renderTemplatePreview(t, params), relatedType: kind === "REBOOK" ? "Customer" : "MybillbookInvoice", relatedId });
    const ok = r.sent;
    await db.reminderLog.create({ data: { kind, dedupeKey: key, customerId, toNumber: mobile, status: ok ? "SENT" : "FAILED", createdAt: now, detail: ok ? null : String((r as { error?: string }).error ?? "").slice(0, 200) } });
    if (ok) res.sent += 1;
    else res.failed += 1;
  };

  for (const c of rebook) await deliver(c.key, "REBOOK", c.customerId, c.mobile, c.name, rebookT, [c.name.split(" ")[0] || "there", milestoneLabel(c.milestone), c.service], c.customerId);
  for (const p of pay) await deliver(p.key, "PAYMENT", p.customerId, p.mobile, p.party, payT, [p.party, p.invoiceNo, formatINR(p.remaining).replace(/^₹\s?/, ""), shortDate(p.due)], p.invoiceKey);
  return res;
}

/** Called every minute by the server scheduler: one real sweep per IST day, inside reminder hours, only while WHATSAPP_REMINDERS=on. Never throws. */
export async function maybeRunDailySweep(now = new Date()) {
  try {
    if (!remindersEnabled()) return;
    const h = istHour(now);
    if (h < REMINDER_HOURS.from || h >= REMINDER_HOURS.to) return;
    const dayStart = new Date(Math.floor((now.getTime() + 5.5 * 3600 * 1000) / 86400000) * 86400000 - 5.5 * 3600 * 1000);
    if (await db.reminderLog.findFirst({ where: { kind: "SWEEP", createdAt: { gte: dayStart } }, select: { id: true } })) return;
    const r = await runLifecycleSweep({ now, send: true });
    await db.reminderLog.create({ data: { kind: "SWEEP", dedupeKey: `SWEEP:${dayStart.toISOString().slice(0, 10)}`, status: "SENT", createdAt: now, detail: JSON.stringify(r) } });
  } catch (e) {
    console.error("[lifecycle-reminders] sweep failed:", e);
  }
}
