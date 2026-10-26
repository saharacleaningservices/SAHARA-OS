import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";
import { formatTalkTime } from "@/lib/call-autoresponder";

/**
 * Phone call → CRM lead (shared by /api/webhook/missed-call and /api/v1/webhooks/call-trigger).
 * Missed call: matches an open / last-24h lead for the number (timeline note) or auto-creates a NEW lead with a
 * 15-minute HIGH call-back follow-up and a team alert. Answered call: only notes an existing lead (never creates one —
 * the team already has the caller on the line and logs the enquiry themselves).
 */
export async function recordCallLead(
  mobile: string,
  event: "MISSED" | "ANSWERED",
  details: { durationSec?: number | null; recordingUrl?: string | null; externalId?: string | null; deviceLabel?: string | null } = {},
  // noCreate: history (back-fill) and outgoing calls are noted on an existing lead only — they never create a lead or a call-back task.
  opts: { noCreate?: boolean } = {},
): Promise<{ leadId: string | null; leadNumber: string | null; name: string | null; created: boolean }> {
  const recent = await db.lead.findFirst({
    where: {
      mobile,
      deletedAt: null,
      OR: [{ stage: { notIn: ["COMPLETED"] } }, { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }],
    },
    orderBy: { createdAt: "desc" },
  });
  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  if (recent) {
    // Talk time and the provider's recording link ride on the same CALL entry (owner 2026-10-26); the timeline shows an audio player for it.
    const talk = details.durationSec ? ` · ${formatTalkTime(details.durationSec)}` : "";
    const phone = details.deviceLabel ? ` · ${details.deviceLabel}` : "";
    // The same call reported twice (app retry, history re-scan) is noted once.
    const dupe = details.externalId
      ? await db.timelineEntry.findFirst({ where: { leadId: recent.id, type: "CALL", meta: { contains: `"externalId":"${details.externalId}"` } }, select: { id: true } }).catch(() => null)
      : null;
    if (!dupe) {
      await addTimelineEntry({
        leadId: recent.id,
        type: "CALL",
        body: (event === "MISSED" ? "Missed call received (auto-detected)" : "Inbound call answered (auto-logged)") + talk + phone,
        audioUrl: details.recordingUrl ?? null,
        meta: details.durationSec || details.recordingUrl || details.externalId ? { durationSec: details.durationSec ?? null, externalId: details.externalId ?? null, source: "call-trigger" } : null,
      }).catch(() => {});
    }
    const name = /^Missed call \d+$/.test(recent.name) ? existingCustomer?.name ?? null : recent.name;
    return { leadId: recent.id, leadNumber: recent.leadNumber, name, created: false };
  }
  if (event === "ANSWERED" || opts.noCreate) return { leadId: null, leadNumber: null, name: existingCustomer?.name ?? null, created: false };

  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: existingCustomer?.name || `Missed call ${mobile}`,
      mobile,
      whatsapp: mobile,
      area: existingCustomer?.area || "—",
      address: existingCustomer?.address || null,
      service: "HOME_DEEP_CLEANING" as never,
      source: "CALL" as never,
      acquisitionChannel: "Phone Call",
      firstTouchSource: "Phone Call",
      firstTouchAt: new Date(),
      latestTouchSource: "Phone Call",
      latestTouchAt: new Date(),
      stage: "NEW",
      notes: "Auto-created from a missed call — call back to qualify.",
    },
  });
  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "CALL", priority: "HIGH", notes: "Missed call — call back" } })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "CALL", body: "Missed call received — lead auto-created", meta: details.externalId ? { externalId: details.externalId, source: "call-trigger" } : null }).catch(() => {});
  await notify({
    kind: "NEW_INQUIRY",
    title: `📞 Missed call — ${existingCustomer?.name || mobile}`,
    body: `Auto-lead ${leadNumber} · call back within 15 min`,
    href: `/leads/${lead.id}`,
  }).catch(() => {});
  return { leadId: lead.id, leadNumber, name: existingCustomer?.name ?? null, created: true };
}
