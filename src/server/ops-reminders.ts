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

async function event(reminderId: string | null, type: string, note?: string | null, actorName?: string | null) {
  await db.opsReminderEvent.create({ data: { reminderId, type, note: note ?? null, actorName: actorName ?? null } }).catch(() => {});
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
    const interval = (r.kind === "JOB_CLOSURE" ? s.jobIntervalMin : s.paymentIntervalMin) * MIN;
    const ok = await db.opsReminder.updateMany({
      where: { id: r.id, status: "OPEN", nextAlertAt: r.nextAlertAt },
      data: { lastAlertAt: now, nextAlertAt: new Date(now.getTime() + interval), alertCount: { increment: 1 } },
    });
    if (ok.count === 1) claimed.push(r);
  }
  const jobs = await loadDetails(claimed.filter((r) => r.kind === "JOB_CLOSURE"));
  const pays = await loadDetails(claimed.filter((r) => r.kind === "PAYMENT_COLLECTION"));

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
  return { jobAlerts: jobs.length, paymentAlerts: pays.length };
}

/** One escalation per reminder to the Super Admin once it has been open too long. */
async function sendEscalations(now: Date, s: OpsSettings) {
  const cutoff = new Date(now.getTime() - s.escalateAfterMin * MIN);
  const candidates = await db.opsReminder.findMany({
    where: { status: "OPEN", escalatedAt: null, dueAt: { lte: cutoff }, createdAt: { lte: cutoff }, OR: [{ followUpUntil: null }, { followUpUntil: { lte: now } }] },
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
  const parts = [
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
  };
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
    return { ...alerts, escalated, dailySummary };
  } finally {
    running = false;
  }
}
