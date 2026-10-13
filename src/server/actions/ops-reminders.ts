"use server";

// Pending-action panel actions (dashboard) — Super Admin + Accounts only,
// checked server-side on every call. Completing a job is always an explicit
// click that goes through the normal updateJobStatus flow (invoice, crew
// snapshot, lead sync…); payments are never recorded here — "Record payment"
// opens the job's existing payment flow. Every action is written to the
// reminder history (OpsReminderEvent) and the Audit Log.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jobPaymentSummary } from "@/lib/payment-status";
import { getOpsSettings, openReminderTotals, runOpsReminderSweep } from "@/server/ops-reminders";
import { updateJobStatus } from "@/server/actions/jobs";

async function requireOffice() {
  const s = await getSession();
  return s && (s.role === "ADMIN" || s.role === "ACCOUNTS") ? s : null;
}

async function log(reminderId: string, type: string, note: string, session: { name: string; email: string; sub: string }, jobId?: string) {
  await db.opsReminderEvent.create({ data: { reminderId, type, note, actorName: session.name } });
  await db.auditLog
    .create({ data: { entityType: "OpsReminder", entityId: reminderId, action: `OPS_REMINDER_${type}`, summary: note, actorName: session.name, actorEmail: session.email } })
    .catch(() => {});
  if (jobId) await db.activityLog.create({ data: { jobId, actorId: session.sub, action: note } }).catch(() => {});
}

export async function getPendingActions() {
  const session = await requireOffice();
  if (!session) return null;
  const settings = await getOpsSettings();
  const open = await db.opsReminder.findMany({ where: { status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 100 });
  const jobs = await db.job.findMany({
    where: { id: { in: open.map((r) => r.jobId) } },
    select: { id: true, jobNumber: true, customerName: true, scheduledDate: true, scheduledTime: true, status: true, startedAt: true, completedAt: true, jobValue: true, payments: { where: { deletedAt: null }, select: { paidAmount: true } } },
  });
  const now = Date.now();
  const items = open.flatMap((r) => {
    const j = jobs.find((x) => x.id === r.jobId);
    if (!j) return [];
    const pay = jobPaymentSummary(j.jobValue, j.payments);
    return [
      {
        id: r.id,
        kind: r.kind as "JOB_CLOSURE" | "PAYMENT_COLLECTION",
        jobId: j.id,
        jobNumber: j.jobNumber,
        customerName: j.customerName,
        scheduledDate: j.scheduledDate.toISOString(),
        scheduledTime: j.scheduledTime,
        dueAt: r.dueAt.toISOString(),
        overdue: r.dueAt.getTime() <= now,
        amountDue: j.jobValue,
        amountReceived: pay.paid,
        balance: pay.balance,
        alertCount: r.alertCount,
        lastAlertAt: r.lastAlertAt?.toISOString() ?? null,
        escalated: Boolean(r.escalatedAt),
        snoozedUntil: r.snoozedUntil && r.snoozedUntil.getTime() > now ? r.snoozedUntil.toISOString() : null,
        followUpUntil: r.followUpUntil && r.followUpUntil.getTime() > now ? r.followUpUntil.toISOString() : null,
        followUpNote: r.followUpNote,
        delayReason: r.delayReason,
        acknowledgedBy: r.acknowledgedBy,
      },
    ];
  });
  return {
    role: session.role,
    soundEnabled: settings.soundEnabled,
    maxSnoozeMin: settings.maxSnoozeMin,
    enabled: settings.enabled,
    // Overdue items, plus delayed jobs (so they can still be closed from here).
    items: items.filter((i) => i.overdue || i.delayReason),
    upcomingClosures: items.filter((i) => !i.overdue && !i.delayReason).length,
  };
}

async function loadOpen(id: string) {
  const r = await db.opsReminder.findUnique({ where: { id } });
  return r && r.status === "OPEN" ? r : null;
}

export async function acknowledgeReminder(id: string) {
  const session = await requireOffice();
  if (!session) return { error: "Not authorized" };
  const r = await loadOpen(id);
  if (!r) return { error: "This reminder is already closed" };
  await db.opsReminder.update({ where: { id }, data: { acknowledgedAt: new Date(), acknowledgedBy: session.name } });
  await log(id, "ACK", `Reminder acknowledged by ${session.name}`, session);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function snoozeReminder(id: string, minutes: number) {
  const session = await requireOffice();
  if (!session) return { error: "Not authorized" };
  const s = await getOpsSettings();
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m < 5 || m > s.maxSnoozeMin) return { error: `Snooze between 5 and ${s.maxSnoozeMin} minutes` };
  const r = await loadOpen(id);
  if (!r) return { error: "This reminder is already closed" };
  const until = new Date(Date.now() + m * 60 * 1000);
  await db.opsReminder.update({ where: { id }, data: { snoozedUntil: until, nextAlertAt: until, acknowledgedAt: new Date(), acknowledgedBy: session.name } });
  await log(id, "SNOOZE", `Snoozed ${m} min by ${session.name}`, session);
  revalidatePath("/dashboard");
  return { success: true as const };
}

const delaySchema = z.object({ reason: z.string().trim().min(3, "Enter the delay reason").max(300), extendMinutes: z.coerce.number().int().min(15).max(8 * 60) });

/** Job closure: the work is genuinely running late — record why and when it should finish. */
export async function recordJobDelay(id: string, values: unknown) {
  const session = await requireOffice();
  if (!session) return { error: "Not authorized" };
  const parsed = delaySchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const r = await loadOpen(id);
  if (!r || r.kind !== "JOB_CLOSURE") return { error: "This reminder is already closed" };
  const due = new Date(Date.now() + parsed.data.extendMinutes * 60 * 1000);
  await db.opsReminder.update({ where: { id }, data: { delayReason: parsed.data.reason, dueAt: due, nextAlertAt: due, snoozedUntil: null, acknowledgedAt: new Date(), acknowledgedBy: session.name } });
  await log(id, "DELAY", `Delay recorded by ${session.name}: ${parsed.data.reason} (expected finish +${parsed.data.extendMinutes} min)`, session, r.jobId);
  revalidatePath("/dashboard");
  return { success: true as const };
}

/** Job closure: explicit "Mark completed" click — runs the normal completion flow. */
export async function completeJobFromReminder(id: string) {
  const session = await requireOffice();
  if (!session) return { error: "Not authorized" };
  const r = await loadOpen(id);
  if (!r || r.kind !== "JOB_CLOSURE") return { error: "This reminder is already closed" };
  const res = await updateJobStatus(r.jobId, "COMPLETED");
  if ("error" in res && res.error) return { error: res.error };
  await db.opsReminder.updateMany({ where: { id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedReason: `Marked completed by ${session.name}` } });
  await log(id, "RESOLVED", `Job marked completed from the pending-action panel by ${session.name}`, session);
  // Pick up the new payment-collection reminder straight away.
  await runOpsReminderSweep().catch(() => {});
  revalidatePath("/dashboard");
  return { success: true as const };
}

const followUpSchema = z.object({
  note: z.string().trim().min(3, "Enter what the customer said").max(300),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Pick the follow-up date"),
});

/** Payment collection: a valid follow-up (what was agreed + when) pauses reminders until that time. */
export async function recordPaymentFollowUp(id: string, values: unknown) {
  const session = await requireOffice();
  if (!session) return { error: "Not authorized" };
  const parsed = followUpSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const raw = parsed.data.followUpDate;
  // Date only → 10:00 AM IST that day; datetime-local is read as IST.
  const until = new Date(`${raw.length === 10 ? `${raw}T10:00` : raw}:00+05:30`);
  const now = Date.now();
  if (Number.isNaN(until.getTime()) || until.getTime() <= now) return { error: "Follow-up must be in the future" };
  if (until.getTime() > now + 14 * 24 * 3600 * 1000) return { error: "Follow-up must be within 14 days" };
  const r = await loadOpen(id);
  if (!r || r.kind !== "PAYMENT_COLLECTION") return { error: "This reminder is already closed" };
  await db.opsReminder.update({ where: { id }, data: { followUpNote: parsed.data.note, followUpUntil: until, nextAlertAt: until, snoozedUntil: null, acknowledgedAt: new Date(), acknowledgedBy: session.name } });
  await log(id, "FOLLOW_UP", `Payment follow-up by ${session.name}: ${parsed.data.note} (next ${until.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })})`, session, r.jobId);
  revalidatePath("/dashboard");
  return { success: true as const };
}

// ── Settings + history (Super Admin only) ──

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    jobIntervalMin: z.coerce.number().int().min(5).max(240),
    paymentIntervalMin: z.coerce.number().int().min(5).max(24 * 60),
    escalateAfterMin: z.coerce.number().int().min(15).max(24 * 60),
    defaultJobHours: z.coerce.number().int().min(1).max(12),
    paymentLookbackDays: z.coerce.number().int().min(1).max(365),
    quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    soundEnabled: z.boolean(),
    maxSnoozeMin: z.coerce.number().int().min(5).max(24 * 60),
    dailySummaryHour: z.coerce.number().int().min(-1).max(23),
    staffSignupNeedsApproval: z.boolean(),
  })
  .strict();

export async function getOpsReminderAdmin() {
  const session = await getSession();
  if (session?.role !== "ADMIN") return null;
  const [settings, history, totals] = await Promise.all([
    getOpsSettings(),
    db.opsReminderEvent.findMany({ orderBy: { createdAt: "desc" }, take: 150, include: { reminder: { select: { kind: true, jobId: true } } } }),
    openReminderTotals(),
  ]);
  const jobs = await db.job.findMany({ where: { id: { in: [...new Set(history.flatMap((h) => (h.reminder ? [h.reminder.jobId] : [])))] } }, select: { id: true, jobNumber: true } });
  return {
    settings,
    totals,
    history: history.map((h) => ({
      id: h.id,
      type: h.type,
      note: h.note,
      actorName: h.actorName,
      createdAt: h.createdAt.toISOString(),
      kind: h.reminder?.kind ?? null,
      jobId: h.reminder?.jobId ?? null,
      jobNumber: jobs.find((j) => j.id === h.reminder?.jobId)?.jobNumber ?? null,
    })),
  };
}

export async function updateOpsReminderSettings(values: unknown) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Only the Super Admin can change reminder settings" };
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  await db.opsReminderSettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data, updatedByName: session.name }, update: { ...parsed.data, updatedByName: session.name } });
  await db.auditLog
    .create({ data: { entityType: "Settings", entityId: "ops-reminders", action: "OPS_REMINDER_SETTINGS_UPDATED", summary: `Reminder settings updated: ${JSON.stringify(parsed.data)}`, actorName: session.name, actorEmail: session.email } })
    .catch(() => {});
  revalidatePath("/admin/reminders");
  return { success: true as const };
}

/** Manual "Run now" from the settings page. */
export async function runOpsRemindersNow() {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Not authorized" };
  return { success: true as const, result: await runOpsReminderSweep() };
}
