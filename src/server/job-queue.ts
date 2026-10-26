// SQLite-backed job queue (no Redis). enqueue() is cheap and never throws into a request; runDueJobs() is called every
// minute by the server scheduler (src/instrumentation.ts) and claims each job atomically, so overlapping ticks or a restart
// can't run one twice. A failing job is retried with back-off (1, 5, 15 min) and then parked as FAILED with the reason.
// Not a "use server" module: nothing here is callable from the browser.
import { db } from "@/lib/db";

export type JobKind = "TEAM_DISPATCH" | "JOB_COMPLETED_NOTICE" | "QUOTATION_NOTICE" | "SERVICE_STARTED_NOTICE";
export const MAX_ATTEMPTS = 4;
const BACKOFF_MIN = [1, 5, 15];
const STALE_RUNNING_MS = 10 * 60_000; // a job stuck RUNNING (process died mid-send) is picked up again after this

export async function enqueueJob(kind: JobKind, payload: Record<string, unknown>, opts: { dedupeKey?: string; delayMs?: number } = {}) {
  try {
    if (opts.dedupeKey) {
      const open = await db.outboxJob.findFirst({ where: { dedupeKey: opts.dedupeKey, status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
      if (open) return { queued: false as const, id: open.id };
    }
    const job = await db.outboxJob.create({ data: { kind, payload: JSON.stringify(payload), dedupeKey: opts.dedupeKey ?? null, runAt: new Date(Date.now() + (opts.delayMs ?? 0)) } });
    return { queued: true as const, id: job.id };
  } catch (e) {
    console.error("[queue] enqueue failed:", e);
    return { queued: false as const, id: null };
  }
}

type Handler = (payload: Record<string, unknown>) => Promise<void>;

export async function runDueJobs(handlers: Record<string, Handler>, limit = 10) {
  const now = new Date();
  // Release jobs whose worker died while RUNNING.
  await db.outboxJob.updateMany({ where: { status: "RUNNING", lockedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }, data: { status: "PENDING", lockedAt: null } });
  const due = await db.outboxJob.findMany({ where: { status: "PENDING", runAt: { lte: now } }, orderBy: { runAt: "asc" }, take: limit, select: { id: true } });
  let done = 0;
  let failed = 0;
  for (const { id } of due) {
    // Atomic claim: only one runner flips PENDING → RUNNING.
    const claimed = await db.outboxJob.updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", lockedAt: new Date(), attempts: { increment: 1 } } });
    if (claimed.count !== 1) continue;
    const job = await db.outboxJob.findUnique({ where: { id } });
    if (!job) continue;
    try {
      const handler = handlers[job.kind];
      if (!handler) throw new Error(`No handler for ${job.kind}`);
      await handler(JSON.parse(job.payload) as Record<string, unknown>);
      await db.outboxJob.update({ where: { id }, data: { status: "DONE", lockedAt: null, lastError: null } });
      done += 1;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      await db.outboxJob.update({
        where: { id },
        data: exhausted
          ? { status: "FAILED", lockedAt: null, lastError: msg }
          : { status: "PENDING", lockedAt: null, lastError: msg, runAt: new Date(Date.now() + (BACKOFF_MIN[job.attempts - 1] ?? 15) * 60_000) },
      });
      failed += 1;
    }
  }
  return { done, failed };
}

/**
 * Housekeeping: finished (DONE) queue rows older than `days` are deleted — they are only the record that a message / dispatch went out
 * (the Message Log and the job's activity log keep the real history). Rows still PENDING / RUNNING and rows parked FAILED (they need a
 * person) are never touched. Returns how many rows were removed.
 */
export async function pruneFinishedJobs(days = 30, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const r = await db.outboxJob.deleteMany({ where: { status: "DONE", updatedAt: { lt: cutoff } } });
  if (r.count > 0) await db.auditLog.create({ data: { entityType: "System", entityId: "outbox-prune", action: "PRUNE", summary: `Removed ${r.count} finished queue row(s) older than ${days} days`, actorName: "System" } }).catch(() => {});
  return r.count;
}
