import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueReviewRequest, reviewDelayMs } from "@/server/job-queue-handlers";
import { verifySignature } from "@/lib/webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/crm — CRM event listener (Phase 2, 2026-11-02).
 * Auth: HMAC-SHA256 of the raw body with CRM_WEBHOOK_SECRET, sent as `x-sahara-signature: sha256=<hex>`. No secret configured →
 * the endpoint is disabled (503), so it can never be called anonymously.
 * Events:
 *   JOB_COMPLETED { jobId | jobNumber } → queues the WhatsApp Google-review request for REVIEW_DELAY_MINUTES (default 120) later.
 *   The CRM's own "Mark Completed" / payment flows queue the same request directly, so this endpoint is for external callers
 *   (n8n, a staff app, another system). Duplicate events are harmless: the queue de-duplicates and the review is sent once per job.
 */
const MAX_BYTES = 4_000;

export async function POST(req: NextRequest) {
  const secret = process.env.CRM_WEBHOOK_SECRET?.trim();
  if (!secret || secret.length < 16) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-sahara-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: { event?: unknown; jobId?: unknown; jobNumber?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.event !== "JOB_COMPLETED") return NextResponse.json({ ok: true, ignored: String(body.event ?? "") }, { status: 202 });

  const jobId = typeof body.jobId === "string" ? body.jobId.slice(0, 40) : null;
  const jobNumber = typeof body.jobNumber === "string" ? body.jobNumber.slice(0, 40) : null;
  if (!jobId && !jobNumber) return NextResponse.json({ error: "jobId or jobNumber required" }, { status: 422 });
  const job = await db.job.findFirst({ where: { deletedAt: null, ...(jobId ? { id: jobId } : { jobNumber: jobNumber! }) }, select: { id: true, jobNumber: true, status: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "COMPLETED") return NextResponse.json({ error: `Job ${job.jobNumber} is ${job.status}, not COMPLETED` }, { status: 409 });

  const q = await enqueueReviewRequest(job.id);
  return NextResponse.json({ ok: true, jobNumber: job.jobNumber, reviewQueued: q.queued || !!q.id, sendsInMinutes: Math.round(reviewDelayMs() / 60_000) }, { status: 202 });
}
