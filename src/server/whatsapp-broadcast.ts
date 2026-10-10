import { db } from "@/lib/db";
import { isOptedOut, normalizeNumber, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";

// Paced WhatsApp broadcast dispatcher (Admin → Marketing → WhatsApp Broadcast).
//
// The app runs as one long-lived Node server, so a campaign is sent by an
// in-process loop at a fixed rate (50–100 messages/minute) instead of a burst
// that Meta would throttle. Progress is in memory; delivery state lives in the
// WhatsAppMessage rows (relatedType "Campaign", relatedId = campaign), so a
// restart or a second click never sends twice to the same number for the same
// campaign — already-sent numbers are skipped.
//
// Who receives it is decided BEFORE a job starts (server/actions/whatsapp-campaigns.ts):
// only numbers with a recorded marketing opt-in and no STOP, and each send
// re-checks the STOP table and the outbound-mode gate in sendWhatsAppTemplate.

export type BroadcastRecipient = { mobile: string; name: string; params: string[]; buttonParam?: string };
export type BroadcastJob = {
  campaign: string;
  templateName: string;
  perMinute: number;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  status: "RUNNING" | "DONE" | "STOPPED";
  startedAt: string;
  finishedAt: string | null;
  startedBy: string;
  lastError: string | null;
};

type Registry = { job: BroadcastJob | null; stop: boolean };
const g = globalThis as unknown as { __saharaBroadcast?: Registry };
const reg: Registry = (g.__saharaBroadcast ??= { job: null, stop: false });

export const BROADCAST_MIN_PER_MINUTE = 50;
export const BROADCAST_MAX_PER_MINUTE = 100;
export const BROADCAST_MAX_RECIPIENTS = 5000;

export function getBroadcastJob(): BroadcastJob | null {
  return reg.job ? { ...reg.job } : null;
}

export function stopBroadcastJob() {
  if (reg.job?.status === "RUNNING") reg.stop = true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts the paced send. Returns false when a broadcast is already running (one at a time). */
export function startBroadcastJob(input: { campaign: string; templateName: string; perMinute: number; recipients: BroadcastRecipient[]; startedBy: string }) {
  if (reg.job?.status === "RUNNING") return false;
  const t = templateByName(input.templateName);
  if (!t) return false;
  const perMinute = Math.min(BROADCAST_MAX_PER_MINUTE, Math.max(BROADCAST_MIN_PER_MINUTE, Math.round(input.perMinute)));
  const recipients = input.recipients.slice(0, BROADCAST_MAX_RECIPIENTS);
  reg.stop = false;
  reg.job = {
    campaign: input.campaign,
    templateName: t.name,
    perMinute,
    total: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    startedBy: input.startedBy,
    lastError: null,
  };
  const job = reg.job;
  const gap = Math.ceil(60_000 / perMinute);

  void (async () => {
    // Numbers this campaign already reached (e.g. before a restart) are never messaged again.
    const done = new Set(
      (await db.whatsAppMessage
        .findMany({ where: { relatedType: "Campaign", relatedId: input.campaign, direction: "OUTBOUND", status: { in: ["SENT", "QUEUED"] } }, select: { toNumber: true } })
        .catch(() => [])).map((m) => m.toNumber.replace(/\D/g, "").slice(-10)),
    );
    for (const r of recipients) {
      if (reg.stop) {
        job.status = "STOPPED";
        break;
      }
      const to = normalizeNumber(r.mobile);
      if (done.has(to.slice(-10)) || (await isOptedOut(to).catch(() => true))) {
        job.skipped++;
        continue;
      }
      const res = await sendWhatsAppTemplate({
        kind: "OTHER",
        toNumber: to,
        toName: r.name || null,
        templateName: t.name,
        languageCode: t.language,
        bodyParams: r.params,
        buttonUrlParams: r.buttonParam ? [{ index: 0, value: r.buttonParam }] : undefined,
        preview: renderTemplatePreview(t, r.params),
        relatedType: "Campaign",
        relatedId: input.campaign,
      }).catch((e: unknown) => ({ sent: false, error: e instanceof Error ? e.message : "send failed" }));
      done.add(to.slice(-10));
      if (res.sent) job.sent++;
      else {
        job.failed++;
        job.lastError = (res as { error?: string }).error ?? job.lastError;
      }
      await sleep(gap);
    }
    if (job.status === "RUNNING") job.status = "DONE";
    job.finishedAt = new Date().toISOString();
    await db.auditLog
      .create({
        data: {
          entityType: "WhatsAppCampaign",
          entityId: input.campaign,
          action: "WHATSAPP_BROADCAST_FINISHED",
          summary: `${input.campaign} (${t.name}) ${job.status}: ${job.sent} sent, ${job.failed} failed, ${job.skipped} skipped of ${job.total} at ${perMinute}/min`,
          actorName: input.startedBy,
        },
      })
      .catch(() => {});
  })();
  return true;
}
