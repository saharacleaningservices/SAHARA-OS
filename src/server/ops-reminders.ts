// Ops reminders (2026-10-13) — server-side, database-backed reminder queue.
//
//   JOB_CLOSURE        a job is STARTED and its scheduled finish has passed
//                      (slot start + defaultJobHours; "Flexible" → started + hours)
//                      → Accounts every jobIntervalMin until it is completed,
//                      a delay reason pushes the due time out, or it is snoozed.
//   PAYMENT_COLLECTION a COMPLETED job still has a balance (job value − recorded
//                      Payment rows, same rule as the CRM job page)
//                      → Accounts every paymentIntervalMin until the balance is
//                      0 (recorded payment) or a follow-up with a date is logged.
//   Escalation         still open escalateAfterMin after it became due (or after
//                      it was first tracked) → one alert to the Super Admin.
//   Daily summary      once per India day at dailySummaryHour → Admin + Accounts.
//
// Quiet hours (IST) hold every alert. Nothing here ever changes a job status or
// a payment — it only reads them and records reminder state/history.
//
// runOpsReminderSweep() is called every minute in-process (src/instrumentation.ts)
// and can also be hit via /api/cron/ops-reminders. Each row is claimed with a
// conditional update before alerting, so overlapping runs never double-send, and
// one notification per kind per sweep goes out (never one per open tab/device).

import { db } from "@/lib/db";
import { IST_MS, istDayKey, istDayRange } from "@/lib/ist-days";
import { slotStartMinutes, formatINR } from "@/lib/utils";
import { jobPaymentSummary } from "@/lib/payment-status";
import { notify } from "@/server/notify";

export type OpsSettings = Awaited<ReturnType<typeof getOpsSettings>>;

export async function getOpsSettings() {
  const row = await db.opsReminderSettings.findUnique({ where: { id: "default" } });
  return row ?? db.opsReminderSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

const MIN = 60 * 1000;
const hm = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Minutes after IST midnight. */
export const istMinuteOfDay = (now: Date) => Math.floor(((now.getTime() + IST_MS) % (24 * 60 * MIN)) / MIN);

export function inQuietHours(now: Date, s: Pick<OpsSettings, "quietStart" | "quietEnd">) {
  const t = istMinuteOfDay(now);
  const a = hm(s.quietStart);
  const b = hm(s.quietEnd);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Expected finish of a job: slot start (IST) + default hours, or started + hours when the slot has no time. */
export function jobDueAt(job: { scheduledDate: Date; scheduledTime: string; startedAt: Date | null }, defaultJobHours: number) {
  const startMin = slotStartMinutes(job.scheduledTime);
  const span = defaultJobHours * 60 * MIN;
  if (startMin < 24 * 60) return new Date(istDayRange(job.scheduledDate).from.getTime() + startMin * MIN + span);
  return new Date((job.startedAt ?? istDayRange(job.scheduledDate).from).getTime() + (job.startedAt ? 0 : 9 * 60 * MIN) + span);
}

async function event(reminderId: string | null, type: string, note?: string | null, actorName?: string | null, userId?: string | null) {
  await db.opsReminderEvent.create({ data: { reminderId, type, note: note ?? null, actorName: actorName ?? null, userId: userId ?? null } }).catch(() => {});
}

export const QUOTATION_KIND = "QUOTATION_FOLLOWUP";
export const FOLLOWUP_KIND = "FOLLOWUP_DUE";
/** Older items are not tracked (they stay visible on their own CRM pages) so going live never floods anyone. */
const QUOTE_LOOKBACK_DAYS = 60;
const FOLLOWUP_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * MIN;
const quoteKey = (id: string) => `Q:${id}`;
const followKey = (id: string) => `F:${id}`;

/**
 * One-time baseline per reminder kind. The first sweep after a kind goes live records everything that is
 * ALREADY overdue as "backlog": silent (first repeat one interval later) and never escalated. A persisted
 * event marks the baseline as done — even when there was nothing to record — so any item that becomes
 * overdue afterwards is treated as a normal, escalatable reminder.
 */
const baselineType = (kind: string) => `BASELINE_${kind}`;
const needsBaseline = async (kind: string) => (await db.opsReminderEvent.count({ where: { type: baselineType(kind) } })) === 0;

function intervalFor(kind: string, s: OpsSettings) {
  return kind === "JOB_CLOSURE" ? s.jobIntervalMin : kind === "PAYMENT_COLLECTION" ? s.paymentIntervalMin : s.followUpIntervalMin;
}

async function resolveOpen(id: string, reason: string, now: Date) {
  const done = await db.opsReminder.updateMany({ where: { id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now, resolvedReason: reason } });
  if (done.count) await event(id, "RESOLVED", reason);
}

/**
 * Quotation follow-ups: tracked while the quotation is still SENT. Only a status change
 * (accepted / rejected / expired / cancelled) or a deleted/cancelled lead closes the reminder —
 * acknowledge / snooze never touch the quotation.
 */
async function syncQuotations(now: Date, s: OpsSettings) {
  const kindFirstRun = await needsBaseline(QUOTATION_KIND);
  const dueBefore = new Date(now.getTime() - s.quotationFollowUpDays * DAY_MS);
  const since = new Date(now.getTime() - QUOTE_LOOKBACK_DAYS * DAY_MS);
  const quotes = await db.quotation.findMany({
    where: { status: "SENT", createdAt: { lte: dueBefore, gte: since }, lead: { deletedAt: null, stage: { not: "CANCELLED" } } },
    select: { id: true, createdAt: true },
    take: 500,
  });
  const have = await db.opsReminder.findMany({ where: { kind: QUOTATION_KIND, jobId: { in: quotes.map((q) => quoteKey(q.id)) } }, select: { jobId: true } });
  for (const q of quotes) {
    if (have.some((r) => r.jobId === quoteKey(q.id))) continue;
    const dueAt = new Date(q.createdAt.getTime() + s.quotationFollowUpDays * DAY_MS);
    // First deployment of this kind: record the backlog silently, first repeat one interval later.
    const next = kindFirstRun ? new Date(now.getTime() + s.followUpIntervalMin * MIN) : dueAt;
    await db.opsReminder.create({ data: { kind: QUOTATION_KIND, jobId: quoteKey(q.id), quotationId: q.id, dueAt, nextAlertAt: next, isBacklog: kindFirstRun, createdAt: now } }).catch(() => {});
  }
  if (kindFirstRun) await event(null, baselineType(QUOTATION_KIND), `Baseline: ${quotes.length} existing quotation(s) recorded silently (no escalation)`);
  const open = await db.opsReminder.findMany({ where: { kind: QUOTATION_KIND, status: "OPEN" }, select: { id: true, quotationId: true } });
  const live = new Set(quotes.map((q) => q.id));
  const stale = open.filter((r) => !r.quotationId || !live.has(r.quotationId));
  if (!stale.length) return;
  const rows = await db.quotation.findMany({
    where: { id: { in: stale.flatMap((r) => (r.quotationId ? [r.quotationId] : [])) } },
    select: { id: true, status: true, lead: { select: { deletedAt: true, stage: true } } },
  });
  for (const r of stale) {
    const q = rows.find((x) => x.id === r.quotationId);
    let reason: string | null;
    if (!q) reason = "Quotation deleted";
    else if (q.status !== "SENT") reason = `Quotation ${q.status.toLowerCase()}`;
    else if (q.lead.deletedAt || q.lead.stage === "CANCELLED") reason = "Lead closed";
    else reason = null; // still SENT but not yet old enough / outside the look-back window → keep it
    if (reason) await resolveOpen(r.id, reason, now);
  }
}

/** Customer follow-ups: due/overdue and not done. Closed only when marked done (or the lead closes / is deleted). */
async function syncFollowUps(now: Date, s: OpsSettings) {
  const kindFirstRun = await needsBaseline(FOLLOWUP_KIND);
  const since = new Date(now.getTime() - FOLLOWUP_LOOKBACK_DAYS * DAY_MS);
  const fups = await db.followUp.findMany({
    where: { isDone: false, dueDate: { lte: now, gte: since }, lead: { deletedAt: null, stage: { notIn: ["CANCELLED", "COMPLETED"] } } },
    select: { id: true, dueDate: true },
    take: 500,
  });
  const have = await db.opsReminder.findMany({ where: { kind: FOLLOWUP_KIND, jobId: { in: fups.map((f) => followKey(f.id)) } }, select: { jobId: true } });
  for (const f of fups) {
    if (have.some((r) => r.jobId === followKey(f.id))) continue;
    // The existing one-shot FOLLOWUP_DUE ping fires first; this repeat starts one interval after the due time.
    const base = kindFirstRun ? now.getTime() : f.dueDate.getTime();
    await db.opsReminder.create({ data: { kind: FOLLOWUP_KIND, jobId: followKey(f.id), followUpId: f.id, dueAt: f.dueDate, nextAlertAt: new Date(base + s.followUpIntervalMin * MIN), isBacklog: kindFirstRun, createdAt: now } }).catch(() => {});
  }
  if (kindFirstRun) await event(null, baselineType(FOLLOWUP_KIND), `Baseline: ${fups.length} existing follow-up(s) recorded silently (no escalation)`);
  const open = await db.opsReminder.findMany({ where: { kind: FOLLOWUP_KIND, status: "OPEN" }, select: { id: true, followUpId: true } });
  const live = new Set(fups.map((f) => f.id));
  const stale = open.filter((r) => !r.followUpId || !live.has(r.followUpId));
  if (!stale.length) return;
  const rows = await db.followUp.findMany({
    where: { id: { in: stale.flatMap((r) => (r.followUpId ? [r.followUpId] : [])) } },
    select: { id: true, isDone: true, lead: { select: { deletedAt: true, stage: true } } },
  });
  for (const r of stale) {
    const f = rows.find((x) => x.id === r.followUpId);
    let reason: string | null;
    if (!f) reason = "Follow-up deleted";
    else if (f.isDone) reason = "Follow-up marked done";
    else if (f.lead.deletedAt || f.lead.stage === "CANCELLED" || f.lead.stage === "COMPLETED") reason = "Lead closed";
    else reason = null; // rescheduled to the future or outside the look-back window → keep it
    if (reason) await resolveOpen(r.id, reason, now);
  }
}

/**
 * Create / reopen / resolve reminder rows from the live job + payment state.
 * First run ever (no reminder history yet = first deployment): the backlog is
 * recorded silently — first repeat one interval later, combined into one alert —
 * and today's daily summary is marked done, so going live never floods anyone.
 */
async function syncReminders(now: Date, s: OpsSettings) {
  const firstRun = (await db.opsReminderEvent.count()) === 0;
  const firstAlert = (dueAt: Date, intervalMin: number) => (firstRun ? new Date(Math.max(dueAt.getTime(), now.getTime() + intervalMin * MIN)) : dueAt);
  // ── Job closure ──
  const started = await db.job.findMany({
    where: { status: "STARTED", deletedAt: null, isDemo: false },
    select: { id: true, scheduledDate: true, scheduledTime: true, startedAt: true },
  });
  const startedIds = new Set(started.map((j) => j.id));
  const existingJob = await db.opsReminder.findMany({ where: { kind: "JOB_CLOSURE", jobId: { in: [...startedIds] } }, select: { id: true, jobId: true, status: true } });
  for (const j of started) {
    const ex = existingJob.find((r) => r.jobId === j.id);
    const dueAt = jobDueAt(j, s.defaultJobHours);
    if (!ex) {
      await db.opsReminder.create({ data: { kind: "JOB_CLOSURE", jobId: j.id, dueAt, nextAlertAt: firstAlert(dueAt, s.jobIntervalMin), createdAt: now } }).catch(() => {}); // unique (kind, jobId) guards races
    } else if (ex.status === "RESOLVED") {
      // Re-started after being closed (e.g. reactivated) → track again from now.
      await db.opsReminder.update({
        where: { id: ex.id },
        data: { status: "OPEN", dueAt: new Date(Math.max(dueAt.getTime(), now.getTime())), nextAlertAt: new Date(Math.max(dueAt.getTime(), now.getTime())), escalatedAt: null, snoozedUntil: null, delayReason: null, resolvedAt: null, resolvedReason: null, createdAt: now },
      });
      await event(ex.id, "REOPENED", "Job started again");
    }
  }
  const openJob = await db.opsReminder.findMany({ where: { kind: "JOB_CLOSURE", status: "OPEN" }, select: { id: true, jobId: true } });
  const gone = openJob.filter((r) => !startedIds.has(r.jobId));
  if (gone.length) {
    const jobs = await db.job.findMany({ where: { id: { in: gone.map((g) => g.jobId) } }, select: { id: true, status: true, deletedAt: true } });
    for (const g of gone) {
      const j = jobs.find((x) => x.id === g.jobId);
      const reason = !j || j.deletedAt ? "Job deleted" : j.status === "COMPLETED" ? "Job marked completed" : `Job status → ${j.status.replaceAll("_", " ").toLowerCase()}`;
      const done = await db.opsReminder.updateMany({ where: { id: g.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now, resolvedReason: reason } });
      if (done.count) await event(g.id, "RESOLVED", reason);
    }
  }

  // ── Payment collection ──
  const since = new Date(now.getTime() - s.paymentLookbackDays * 24 * 60 * MIN);
  const completed = await db.job.findMany({
    where: { status: "COMPLETED", deletedAt: null, isDemo: false, jobValue: { gt: 0 }, completedAt: { gte: since } },
    select: { id: true, completedAt: true, jobValue: true, payments: { where: { deletedAt: null }, select: { paidAmount: true } } },
  });
  const owing = new Map<string, Date>();
  for (const j of completed) if (jobPaymentSummary(j.jobValue, j.payments).balance > 0) owing.set(j.id, j.completedAt ?? now);
  const existingPay = await db.opsReminder.findMany({ where: { kind: "PAYMENT_COLLECTION", jobId: { in: [...owing.keys()] } }, select: { id: true, jobId: true } });
  for (const [jobId, completedAt] of owing) {
    if (existingPay.some((r) => r.jobId === jobId)) continue;
    await db.opsReminder.create({ data: { kind: "PAYMENT_COLLECTION", jobId, dueAt: completedAt, nextAlertAt: firstRun ? new Date(now.getTime() + s.paymentIntervalMin * MIN) : now, createdAt: now } }).catch(() => {});
  }
  const openPay = await db.opsReminder.findMany({ where: { kind: "PAYMENT_COLLECTION", status: "OPEN" }, select: { id: true, jobId: true } });
  const settled = openPay.filter((r) => !owing.has(r.jobId));
  if (settled.length) {
    const jobs = await db.job.findMany({
      where: { id: { in: settled.map((r) => r.jobId) } },
      select: { id: true, status: true, deletedAt: true, completedAt: true, jobValue: true, payments: { where: { deletedAt: null }, select: { paidAmount: true } } },
    });
    for (const r of settled) {
      const j = jobs.find((x) => x.id === r.jobId);
      let reason: string | null;
      if (!j || j.deletedAt) reason = "Job deleted";
      else if (j.status !== "COMPLETED") reason = `Job status → ${j.status.replaceAll("_", " ").toLowerCase()}`;
      else if (jobPaymentSummary(j.jobValue, j.payments).balance <= 0) reason = "Payment recorded — balance cleared";
      else reason = null; // still owing but outside the look-back window → keep it open (already being tracked)
      if (!reason) continue;
      const done = await db.opsReminder.updateMany({ where: { id: r.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now, resolvedReason: reason } });
      if (done.count) await event(r.id, "RESOLVED", reason);
    }
  }

  await syncQuotations(now, s);
  await syncFollowUps(now, s);

  if (firstRun) {
    const tracked = await db.opsReminder.count({ where: { status: "OPEN" } });
    await db.opsReminderSettings.update({ where: { id: "default" }, data: { lastDailySummaryDay: istDayKey(now) } });
    s.lastDailySummaryDay = istDayKey(now);
    await event(null, "INITIALIZED", `Reminders started — ${tracked} open item(s) recorded silently; first repeats follow the normal interval`);
  }
}

async function recipientsFallback() {
  // If no active Accounts login exists, the Super Admin receives the repeats instead.
  const accounts = await db.user.count({ where: { role: "ACCOUNTS", isActive: true } });
  if (accounts > 0) return undefined;
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

const fmtSlot = (d: Date, slot: string) => `${new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} ${slot}`;
const ago = (from: Date, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - from.getTime()) / MIN));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

type Detail = { id: string; jobId: string; jobNumber: string; customerName: string; scheduledDate: Date; scheduledTime: string; dueAt: Date; jobValue: number; paid: number; balance: number };

async function loadDetails(rows: { id: string; jobId: string; dueAt: Date }[]): Promise<Detail[]> {
  if (!rows.length) return [];
  const jobs = await db.job.findMany({
    where: { id: { in: rows.map((r) => r.jobId) } },
    select: { id: true, jobNumber: true, customerName: true, scheduledDate: true, scheduledTime: true, jobValue: true, payments: { where: { deletedAt: null }, select: { paidAmount: true } } },
  });
  return rows.flatMap((r) => {
    const j = jobs.find((x) => x.id === r.jobId);
    if (!j) return [];
    const p = jobPaymentSummary(j.jobValue, j.payments);
    return [{ id: r.id, jobId: j.id, jobNumber: j.jobNumber, customerName: j.customerName, scheduledDate: j.scheduledDate, scheduledTime: j.scheduledTime, dueAt: r.dueAt, jobValue: j.jobValue, paid: p.paid, balance: p.balance }];
  });
}

export type QuoteDetail = { id: string; quotationId: string; quoteNumber: string; leadId: string; leadName: string; amount: number; dueAt: Date };
export type FollowUpDetail = { id: string; followUpId: string; leadId: string; leadName: string; type: string; notes: string | null; dueAt: Date };

export async function loadQuoteDetails(rows: { id: string; quotationId: string | null; dueAt: Date }[]): Promise<QuoteDetail[]> {
  const ids = rows.flatMap((r) => (r.quotationId ? [r.quotationId] : []));
  if (!ids.length) return [];
  const qs = await db.quotation.findMany({ where: { id: { in: ids } }, select: { id: true, quoteNumber: true, totalAmount: true, lead: { select: { id: true, name: true } } } });
  return rows.flatMap((r) => {
    const q = qs.find((x) => x.id === r.quotationId);
    return q ? [{ id: r.id, quotationId: q.id, quoteNumber: q.quoteNumber, leadId: q.lead.id, leadName: q.lead.name, amount: q.totalAmount, dueAt: r.dueAt }] : [];
  });
}

export async function loadFollowUpDetails(rows: { id: string; followUpId: string | null; dueAt: Date }[]): Promise<FollowUpDetail[]> {
  const ids = rows.flatMap((r) => (r.followUpId ? [r.followUpId] : []));
  if (!ids.length) return [];
  const fs = await db.followUp.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, notes: true, lead: { select: { id: true, name: true } } } });
  return rows.flatMap((r) => {
    const f = fs.find((x) => x.id === r.followUpId);
    return f ? [{ id: r.id, followUpId: f.id, leadId: f.lead.id, leadName: f.lead.name, type: String(f.type), notes: f.notes, dueAt: r.dueAt }] : [];
  });
}

const list = (items: string[]) => items.slice(0, 3).join(" · ") + (items.length > 3 ? ` · +${items.length - 3} more` : "");

/** Send the due repeats (claimed atomically) — one notification per kind. */
async function sendDueAlerts(now: Date, s: OpsSettings, extraUserIds?: string[]) {
  const due = await db.opsReminder.findMany({
    where: {
      status: "OPEN",
      nextAlertAt: { lte: now },
      dueAt: { lte: now },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      AND: [{ OR: [{ followUpUntil: null }, { followUpUntil: { lte: now } }] }],
    },
    orderBy: { dueAt: "asc" },
    take: 200,
  });
  const claimed: typeof due = [];
  for (const r of due) {
    const interval = intervalFor(r.kind, s) * MIN;
    const ok = await db.opsReminder.updateMany({
      where: { id: r.id, status: "OPEN", nextAlertAt: r.nextAlertAt },
      data: { lastAlertAt: now, nextAlertAt: new Date(now.getTime() + interval), alertCount: { increment: 1 } },
    });
    if (ok.count === 1) claimed.push(r);
  }
  const jobs = await loadDetails(claimed.filter((r) => r.kind === "JOB_CLOSURE"));
  const pays = await loadDetails(claimed.filter((r) => r.kind === "PAYMENT_COLLECTION"));
  const quotes = await loadQuoteDetails(claimed.filter((r) => r.kind === QUOTATION_KIND));
  const fups = await loadFollowUpDetails(claimed.filter((r) => r.kind === FOLLOWUP_KIND));

  if (jobs.length) {
    const one = jobs[0];
    await notify({
      kind: "OPS_JOB_CLOSURE",
      title: jobs.length === 1 ? `Close job ${one.jobNumber} — overdue ${ago(one.dueAt, now)}` : `${jobs.length} started jobs not marked completed`,
      body:
        jobs.length === 1
          ? `${one.customerName} · scheduled ${fmtSlot(one.scheduledDate, one.scheduledTime)}. Mark completed or record a delay reason.`
          : list(jobs.map((j) => `${j.jobNumber} ${j.customerName} (${j.scheduledTime})`)),
      href: jobs.length === 1 ? `/jobs/${one.jobId}` : "/dashboard#pending-actions",
      tag: "ops-job-closure",
      extraUserIds,
    });
    for (const j of jobs) await event(j.id, "ALERT", `Closure reminder sent (overdue ${ago(j.dueAt, now)})`);
  }
  if (pays.length) {
    const one = pays[0];
    const total = pays.reduce((a, p) => a + p.balance, 0);
    await notify({
      kind: "OPS_PAYMENT_DUE",
      title: pays.length === 1 ? `Collect ${formatINR(one.balance)} — ${one.jobNumber}` : `${pays.length} completed jobs unpaid · ${formatINR(total)} outstanding`,
      body:
        pays.length === 1
          ? `${one.customerName} · due ${formatINR(one.jobValue)} · received ${formatINR(one.paid)} · balance ${formatINR(one.balance)}. Record the payment or log a follow-up.`
          : list(pays.map((p) => `${p.jobNumber} ${p.customerName} ${formatINR(p.balance)}`)),
      href: pays.length === 1 ? `/jobs/${one.jobId}` : "/dashboard#pending-actions",
      tag: "ops-payment",
      extraUserIds,
    });
    for (const p of pays) await event(p.id, "ALERT", `Collection reminder sent (balance ${formatINR(p.balance)})`);
  }
  if (quotes.length) {
    const one = quotes[0];
    await notify({
      kind: "OPS_QUOTATION_FOLLOWUP",
      title: quotes.length === 1 ? `Follow up quotation ${one.quoteNumber} — ${one.leadName}` : `${quotes.length} quotations need a follow-up`,
      body: quotes.length === 1 ? `Follow-up due ${ago(one.dueAt, now)} ago · ${formatINR(one.amount)}. Call the customer, then update the quotation status.` : list(quotes.map((q) => `${q.quoteNumber} ${q.leadName} ${formatINR(q.amount)}`)),
      href: quotes.length === 1 ? `/leads/${one.leadId}` : "/dashboard#pending-actions",
      tag: "ops-quotation",
      extraUserIds,
    });
    for (const q of quotes) await event(q.id, "ALERT", `Quotation follow-up reminder sent (${q.quoteNumber})`);
  }
  if (fups.length) {
    const one = fups[0];
    await notify({
      kind: "OPS_FOLLOWUP_DUE",
      title: fups.length === 1 ? `Follow-up overdue — ${one.leadName}` : `${fups.length} customer follow-ups overdue`,
      body: fups.length === 1 ? `${one.type.toLowerCase()} was due ${ago(one.dueAt, now)} ago${one.notes ? ` · ${one.notes}` : ""}. Mark it done once you have spoken to the customer.` : list(fups.map((f) => `${f.leadName} (${f.type.toLowerCase()})`)),
      href: fups.length === 1 ? `/leads/${one.leadId}` : "/dashboard#pending-actions",
      tag: "ops-followup",
      extraUserIds,
    });
    for (const f of fups) await event(f.id, "ALERT", `Follow-up reminder sent (${f.leadName})`);
  }
  return { jobAlerts: jobs.length, paymentAlerts: pays.length, quotationAlerts: quotes.length, followUpAlerts: fups.length };
}

/** One escalation per reminder to the Super Admin once it has been open too long. */
async function sendEscalations(now: Date, s: OpsSettings) {
  const cutoff = new Date(now.getTime() - s.escalateAfterMin * MIN);
  const candidates = await db.opsReminder.findMany({
    where: { status: "OPEN", escalatedAt: null, isBacklog: false, dueAt: { lte: cutoff }, createdAt: { lte: cutoff }, OR: [{ followUpUntil: null }, { followUpUntil: { lte: now } }] },
    take: 200,
  });
  const claimed: typeof candidates = [];
  for (const r of candidates) {
    const ok = await db.opsReminder.updateMany({ where: { id: r.id, escalatedAt: null, status: "OPEN" }, data: { escalatedAt: now } });
    if (ok.count === 1) claimed.push(r);
  }
  if (!claimed.length) return 0;
  const details = await loadDetails(claimed);
  const jobs = details.filter((d) => claimed.find((c) => c.id === d.id)?.kind === "JOB_CLOSURE");
  const pays = details.filter((d) => claimed.find((c) => c.id === d.id)?.kind === "PAYMENT_COLLECTION");
  const nQuotes = claimed.filter((c) => c.kind === QUOTATION_KIND).length;
  const nFups = claimed.filter((c) => c.kind === FOLLOWUP_KIND).length;
  const parts = [
    nQuotes ? `${nQuotes} quotation${nQuotes > 1 ? "s" : ""} awaiting follow-up` : "",
    nFups ? `${nFups} customer follow-up${nFups > 1 ? "s" : ""} overdue` : "",
    jobs.length ? `${jobs.length} job${jobs.length > 1 ? "s" : ""} not closed: ${list(jobs.map((j) => j.jobNumber))}` : "",
    pays.length ? `${pays.length} unpaid (${formatINR(pays.reduce((a, p) => a + p.balance, 0))}): ${list(pays.map((p) => p.jobNumber))}` : "",
  ].filter(Boolean);
  await notify({
    kind: "OPS_ESCALATION",
    title: `Escalation: ${claimed.length} pending action${claimed.length > 1 ? "s" : ""} unresolved for ${Math.round(s.escalateAfterMin / 60) || 1}+ h`,
    body: parts.join(" | "),
    href: "/dashboard#pending-actions",
    tag: "ops-escalation",
    critical: true,
  });
  for (const r of claimed) await event(r.id, "ESCALATED", "Escalated to Super Admin");
  return claimed.length;
}

/** Counts used by the daily summary and the dashboard panel header. */
export async function openReminderTotals() {
  const open = await db.opsReminder.findMany({ where: { status: "OPEN" }, select: { id: true, kind: true, jobId: true, dueAt: true } });
  const pays = await loadDetails(open.filter((r) => r.kind === "PAYMENT_COLLECTION"));
  return {
    jobClosures: open.filter((r) => r.kind === "JOB_CLOSURE").length,
    payments: pays.length,
    outstanding: pays.reduce((a, p) => a + p.balance, 0),
    quotations: open.filter((r) => r.kind === QUOTATION_KIND).length,
    followUps: open.filter((r) => r.kind === FOLLOWUP_KIND).length,
  };
}

const EOD_LIST_MAX = 10;
/** A missed EOD is still sent within this many minutes after eodSummaryTime (sweep restart, brief outage); later it is skipped for the day. */
export const EOD_GRACE_MIN = 120;

/**
 * End-of-day picture, read LIVE from the CRM tables (not from reminder rows), so a snoozed or
 * acknowledged reminder never hides an unresolved item. Office roles only (money figures) —
 * the caller enforces that.
 */
export async function getEodSummary(now: Date = new Date(), s?: Pick<OpsSettings, "paymentLookbackDays">) {
  const lookback = s?.paymentLookbackDays ?? (await getOpsSettings()).paymentLookbackDays;
  const started = await db.job.findMany({
    where: { status: "STARTED", deletedAt: null, isDemo: false },
    orderBy: { scheduledDate: "asc" },
    select: { id: true, jobNumber: true, customerName: true, scheduledDate: true, scheduledTime: true },
  });
  const completed = await db.job.findMany({
    where: { status: "COMPLETED", deletedAt: null, isDemo: false, jobValue: { gt: 0 }, completedAt: { gte: new Date(now.getTime() - lookback * DAY_MS) } },
    orderBy: { completedAt: "asc" },
    select: { id: true, jobNumber: true, customerName: true, jobValue: true, payments: { where: { deletedAt: null }, select: { paidAmount: true } } },
  });
  const unpaid = completed.flatMap((j) => {
    const balance = jobPaymentSummary(j.jobValue, j.payments).balance;
    return balance > 0 ? [{ id: j.id, jobNumber: j.jobNumber, customerName: j.customerName, balance }] : [];
  });
  const quotes = await db.quotation.findMany({
    where: { status: "SENT", createdAt: { gte: new Date(now.getTime() - QUOTE_LOOKBACK_DAYS * DAY_MS) }, lead: { deletedAt: null, stage: { not: "CANCELLED" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, quoteNumber: true, totalAmount: true, lead: { select: { id: true, name: true } } },
  });
  const fups = await db.followUp.findMany({
    where: { isDone: false, dueDate: { lte: now, gte: new Date(now.getTime() - FOLLOWUP_LOOKBACK_DAYS * DAY_MS) }, lead: { deletedAt: null, stage: { notIn: ["CANCELLED", "COMPLETED"] } } },
    orderBy: { dueDate: "asc" },
    select: { id: true, dueDate: true, type: true, lead: { select: { id: true, name: true } } },
  });
  return {
    generatedAt: now.toISOString(),
    incompleteJobs: { count: started.length, items: started.slice(0, EOD_LIST_MAX).map((j) => ({ id: j.id, jobNumber: j.jobNumber, customerName: j.customerName, scheduledTime: j.scheduledTime, scheduledDate: j.scheduledDate.toISOString() })) },
    unpaidJobs: { count: unpaid.length, outstanding: unpaid.reduce((a, u) => a + u.balance, 0), items: unpaid.slice(0, EOD_LIST_MAX) },
    openQuotations: { count: quotes.length, total: quotes.reduce((a, q) => a + q.totalAmount, 0), items: quotes.slice(0, EOD_LIST_MAX).map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, leadId: q.lead.id, leadName: q.lead.name, amount: q.totalAmount })) },
    overdueFollowUps: { count: fups.length, items: fups.slice(0, EOD_LIST_MAX).map((f) => ({ id: f.id, leadId: f.lead.id, leadName: f.lead.name, type: String(f.type), dueDate: f.dueDate.toISOString() })) },
  };
}

export type EodSummary = Awaited<ReturnType<typeof getEodSummary>>;
export const eodTotal = (e: EodSummary) => e.incompleteJobs.count + e.unpaidJobs.count + e.openQuotations.count + e.overdueFollowUps.count;

/** Minutes after midnight for a valid "HH:MM" (IST); null when disabled ("off") or malformed. */
export function parseEodTime(v: string | null | undefined): number | null {
  if (!v || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
  return hm(v);
}

/** Once per India day at eodSummaryTime → Admin + Accounts (claimed atomically; first sweep after the time wins). */
async function maybeEodSummary(now: Date, s: OpsSettings) {
  const at = parseEodTime(s.eodSummaryTime);
  const t = istMinuteOfDay(now);
  if (at === null || t < at) return false;
  const day = istDayKey(now);
  if (s.lastEodSummaryDay === day) return false;
  const claim = await db.opsReminderSettings.updateMany({
    where: { id: "default", OR: [{ lastEodSummaryDay: null }, { lastEodSummaryDay: { not: day } }] },
    data: { lastEodSummaryDay: day },
  });
  if (claim.count !== 1) return false;
  // Never send a surprise EOD just because the feature (or a restart) happened after the cut-off:
  //  - very first run ever → today is the baseline, the first real EOD goes out tomorrow;
  //  - later than the grace window → today's EOD is skipped (logged), tomorrow's is unaffected.
  if (s.lastEodSummaryDay === null) {
    await event(null, "EOD_SKIPPED", `EOD ${day}: first run after the ${s.eodSummaryTime} cut-off — baseline only, first summary tomorrow`);
    return false;
  }
  if (t > at + EOD_GRACE_MIN) {
    await event(null, "EOD_SKIPPED", `EOD ${day}: ${s.eodSummaryTime} cut-off passed more than ${EOD_GRACE_MIN} min ago — skipped for today`);
    return false;
  }
  const e = await getEodSummary(now, s);
  const total = eodTotal(e);
  await notify({
    kind: "OPS_EOD_SUMMARY",
    title: total === 0 ? "End of day: nothing pending" : `End of day: ${total} item${total === 1 ? "" : "s"} still open`,
    body:
      total === 0
        ? "All started jobs closed, payments collected, quotations and follow-ups up to date."
        : `${e.incompleteJobs.count} incomplete job${e.incompleteJobs.count === 1 ? "" : "s"} · ${e.unpaidJobs.count} unpaid (${formatINR(e.unpaidJobs.outstanding)}) · ${e.openQuotations.count} open quotation${e.openQuotations.count === 1 ? "" : "s"} · ${e.overdueFollowUps.count} overdue follow-up${e.overdueFollowUps.count === 1 ? "" : "s"}`,
    href: "/dashboard#pending-actions",
    tag: "ops-eod",
  });
  await event(null, "EOD_SUMMARY", `EOD ${day}: ${e.incompleteJobs.count} incomplete, ${e.unpaidJobs.count} unpaid (${formatINR(e.unpaidJobs.outstanding)}), ${e.openQuotations.count} quotations, ${e.overdueFollowUps.count} follow-ups`);
  return true;
}

/**
 * Per-user alert preferences (own account only — the action wrapper passes the session user).
 * Neither switch touches reminder tracking: items stay in the queue and on the dashboard.
 */
export async function setUserReminderPrefs(user: { id: string; name: string }, prefs: { soundEnabled?: boolean; notificationsEnabled?: boolean }) {
  const data: { soundEnabled?: boolean; notificationsEnabled?: boolean } = {};
  if (typeof prefs.soundEnabled === "boolean") data.soundEnabled = prefs.soundEnabled;
  if (typeof prefs.notificationsEnabled === "boolean") data.notificationsEnabled = prefs.notificationsEnabled;
  if (!Object.keys(data).length) return null;
  const updated = await db.user.update({ where: { id: user.id }, data, select: { soundEnabled: true, notificationsEnabled: true } });
  const parts = [data.soundEnabled !== undefined ? `sound ${data.soundEnabled ? "ON" : "OFF"}` : "", data.notificationsEnabled !== undefined ? `notifications ${data.notificationsEnabled ? "ON" : "OFF"}` : ""].filter(Boolean);
  await event(null, "PREF_CHANGE", `${user.name}: ${parts.join(", ")}`, user.name, user.id);
  return updated;
}

/** Marks the user's EOD popup notification(s) as seen. Never changes any CRM record or reminder. */
export async function acknowledgeEod(user: { id: string; name: string }) {
  const r = await db.notification.updateMany({ where: { userId: user.id, kind: "OPS_EOD_SUMMARY", readAt: null }, data: { readAt: new Date() } });
  if (r.count) await event(null, "EOD_ACK", `EOD summary acknowledged by ${user.name}`, user.name, user.id);
  return r.count;
}

async function maybeDailySummary(now: Date, s: OpsSettings) {
  if (s.dailySummaryHour < 0 || istMinuteOfDay(now) < s.dailySummaryHour * 60) return false;
  const day = istDayKey(now);
  if (s.lastDailySummaryDay === day) return false;
  const claim = await db.opsReminderSettings.updateMany({
    where: { id: "default", OR: [{ lastDailySummaryDay: null }, { lastDailySummaryDay: { not: day } }] },
    data: { lastDailySummaryDay: day },
  });
  if (claim.count !== 1) return false;
  const t = await openReminderTotals();
  await notify({
    kind: "OPS_DAILY_SUMMARY",
    title: `Daily summary: ${t.jobClosures} job closure${t.jobClosures === 1 ? "" : "s"} · ${t.payments} unpaid job${t.payments === 1 ? "" : "s"}`,
    body: t.jobClosures + t.payments === 0 ? "Nothing pending — all started jobs closed and payments collected." : `Outstanding collection ${formatINR(t.outstanding)}. Open the dashboard to act.`,
    href: "/dashboard#pending-actions",
    tag: "ops-daily",
  });
  await event(null, "DAILY_SUMMARY", `${t.jobClosures} closures, ${t.payments} unpaid (${formatINR(t.outstanding)})`);
  return true;
}

let running = false;

export async function runOpsReminderSweep(now: Date = new Date()) {
  if (running) return { skipped: "already running" as const };
  running = true;
  try {
    const s = await getOpsSettings();
    if (!s.enabled) return { skipped: "disabled" as const };
    await syncReminders(now, s);
    if (inQuietHours(now, s)) return { quiet: true as const };
    const extra = await recipientsFallback();
    const alerts = await sendDueAlerts(now, s, extra);
    const escalated = await sendEscalations(now, s);
    const dailySummary = await maybeDailySummary(now, s);
    const eodSummary = await maybeEodSummary(now, s);
    return { ...alerts, escalated, dailySummary, eodSummary };
  } finally {
    running = false;
  }
}
