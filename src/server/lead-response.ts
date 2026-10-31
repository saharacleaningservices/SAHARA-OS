import { db } from "@/lib/db";
import { LEAD_RESPONSE_SLA_MS } from "@/lib/lead-response";
import { notify } from "@/server/notify";

// Uncontacted-lead alert. A lead still in stage NEW 15 minutes after it arrived pings Admin + Accounts once.
//
// Zero VPS overhead by design: no timer, no loop. It rides the notification feed request the CRM already makes every
// 20 s from an open tab, is throttled to one run per minute per server process, and costs one indexed query
// (stage + createdAt, max 10 rows) plus one dedupe lookup per overdue lead. It only matters while someone has the CRM
// open — exactly when a popup/sound is useful — and Web Push reaches installed phones.

let lastRun = 0;
const MIN_GAP_MS = 60_000;

export async function sweepUncontactedLeads(now = new Date()): Promise<{ checked: number; alerted: number }> {
  const overdueBefore = new Date(now.getTime() - LEAD_RESPONSE_SLA_MS);
  const lookback = new Date(now.getTime() - 24 * 3600 * 1000);
  const leads = await db.lead.findMany({
    where: { deletedAt: null, stage: "NEW", createdAt: { gte: lookback, lte: overdueBefore } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, name: true, leadNumber: true, createdAt: true },
  });
  let alerted = 0;
  for (const lead of leads) {
    // meta carries the lead id as JSON; one alert per lead ever (it only fires within 24 h of arrival).
    const already = await db.notification.count({ where: { kind: "LEAD_UNCONTACTED", meta: { contains: lead.id } } });
    if (already) continue;
    const mins = Math.round((now.getTime() - lead.createdAt.getTime()) / 60000);
    await notify({
      kind: "LEAD_UNCONTACTED",
      title: `⏱ Uncontacted lead — ${lead.name}`,
      body: `${lead.leadNumber} has waited ${mins} min with no contact. Call now.`,
      href: `/leads/${lead.id}`,
      meta: { leadId: lead.id },
      critical: true,
      tag: `uncontacted-${lead.id}`,
    }).catch(() => {});
    alerted += 1;
  }
  return { checked: leads.length, alerted };
}

/** Fire-and-forget, at most once a minute per process. Never throws. */
export function maybeSweepUncontactedLeads() {
  const t = Date.now();
  if (t - lastRun < MIN_GAP_MS) return;
  lastRun = t;
  void sweepUncontactedLeads().catch(() => {});
}
