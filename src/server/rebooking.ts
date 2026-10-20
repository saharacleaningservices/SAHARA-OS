import { db } from "@/lib/db";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { renderTemplatePreview, templateByName } from "@/lib/whatsapp-cloud-templates";
import { SERVICE_LABELS } from "@/lib/constants";

// Re-booking reminders: a gentle "time for your next clean" WhatsApp 3 and 6 months after a job was completed.
//   • OFF unless REBOOKING_REMINDERS=on (owner switch in Coolify, same idea as WHATSAPP_CAMPAIGNS) — it is promotional.
//   • Uses the approved MARKETING template sahara_customer_reactivation, so the consent guard in sendWhatsAppTemplate
//     only lets it reach a recorded opt-in, and TEST mode still limits it to the QA number.
//   • No schema change: each send is recorded as a WhatsAppMessage with relatedType REBOOK_3M / REBOOK_6M and the job id,
//     which is also the dedup key (one reminder per job per interval, ever).
//   • Skips customers who already booked something newer than the completed job.
// The daily cron (/api/cron/reminders) calls runRebookingReminders(); safe to run any number of times.

export const REBOOK_MONTHS = [3, 6] as const;
const CATCH_UP_DAYS = 7; // a missed cron day is picked up for a week, then dropped (never a stale reminder)

export const rebookMarker = (months: number) => `REBOOK_${months}M`;

/** Completion-date window whose jobs are due their `months`-month reminder at `now`. */
export function rebookWindow(now: Date, months: number): { from: Date; to: Date } {
  const to = new Date(now);
  to.setMonth(to.getMonth() - months);
  const from = new Date(to.getTime() - CATCH_UP_DAYS * 86_400_000);
  return { from, to };
}

export function rebookingEnabled(): boolean {
  return process.env.REBOOKING_REMINDERS === "on";
}

export async function runRebookingReminders(now = new Date()) {
  if (!rebookingEnabled()) return { enabled: false as const, sent: 0, skipped: 0 };
  const t = templateByName("sahara_customer_reactivation");
  if (!t) return { enabled: true as const, sent: 0, skipped: 0 };
  let sent = 0;
  let skipped = 0;

  for (const months of REBOOK_MONTHS) {
    const { from, to } = rebookWindow(now, months);
    const jobs = await db.job.findMany({
      where: { status: "COMPLETED", deletedAt: null, completedAt: { gt: from, lte: to } },
      select: { id: true, customerName: true, customerMobile: true, service: true, completedAt: true },
      take: 500,
    });
    for (const job of jobs) {
      const mobile = job.customerMobile.replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) { skipped++; continue; }
      const done = await db.whatsAppMessage.findFirst({ where: { relatedType: rebookMarker(months), relatedId: job.id }, select: { id: true } });
      if (done) { skipped++; continue; }
      // Already re-booked: any newer, non-cancelled job for the same mobile.
      const newer = await db.job.findFirst({
        where: { customerMobile: { endsWith: mobile }, deletedAt: null, status: { not: "CANCELLED" }, id: { not: job.id }, createdAt: { gt: job.completedAt! } },
        select: { id: true },
      });
      if (newer) { skipped++; continue; }
      const first = job.customerName.trim().split(/\s+/)[0] || "there";
      const service = (SERVICE_LABELS[job.service] ?? job.service).toLowerCase();
      const params = [first, service];
      const res = await sendWhatsAppTemplate({
        kind: "OTHER",
        toNumber: mobile,
        toName: job.customerName,
        templateName: t.name,
        languageCode: t.language,
        bodyParams: params,
        buttonUrlParams: [{ index: 0, value: `home-deep-cleaning-pune?utm_source=whatsapp&utm_medium=reminder&utm_campaign=rebook_${months}m` }],
        preview: renderTemplatePreview(t, params),
        relatedType: rebookMarker(months),
        relatedId: job.id,
      }).catch(() => null);
      if (res && "sent" in res && res.sent) sent++;
      else skipped++;
    }
  }
  return { enabled: true as const, sent, skipped };
}
