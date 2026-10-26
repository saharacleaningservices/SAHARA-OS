import { db } from "@/lib/db";

export type CtwaRow = { campaign: string; adId: string | null; leads: number; booked: number; last: Date };

/** Click-to-WhatsApp ad leads (lead.utmMedium = click_to_whatsapp) grouped by ad campaign — last N days. */
export async function getCtwaLeadStats(days = 90, now: Date = new Date()): Promise<{ rows: CtwaRow[]; total: number; booked: number }> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const leads = await db.lead.findMany({
    where: { deletedAt: null, isDemo: false, utmMedium: "click_to_whatsapp", createdAt: { gte: since } },
    select: { utmCampaign: true, utmContent: true, createdAt: true, jobs: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const by = new Map<string, CtwaRow>();
  for (const l of leads) {
    const key = `${l.utmCampaign ?? "click_to_whatsapp"}|${l.utmContent ?? ""}`;
    const row = by.get(key) ?? { campaign: l.utmCampaign ?? "click_to_whatsapp", adId: l.utmContent ?? null, leads: 0, booked: 0, last: l.createdAt };
    row.leads += 1;
    if (l.jobs.length) row.booked += 1;
    if (l.createdAt > row.last) row.last = l.createdAt;
    by.set(key, row);
  }
  const rows = [...by.values()].sort((a, b) => b.leads - a.leads);
  return { rows, total: leads.length, booked: rows.reduce((t, r) => t + r.booked, 0) };
}
