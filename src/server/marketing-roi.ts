import { db } from "@/lib/db";

// Admin Marketing ROI: spend → leads → qualified → bookings → completed → revenue,
// grouped by the lead's ORIGINAL acquisition channel (and campaign).
// Revenue = value of completed jobs linked to the lead.

const QUALIFIED_STAGES = ["INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION", "CONFIRMED", "JOB_SCHEDULED", "COMPLETED"];
const BOOKED_STAGES = ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"];

export type RoiRow = {
  channel: string;
  campaign: string;
  spend: number;
  leads: number;
  qualified: number;
  bookings: number;
  completed: number;
  revenue: number;
};

export async function getMarketingRoi(opts: { from?: Date; to?: Date; byCampaign?: boolean }) {
  const createdAt = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) };
  const leads = await db.lead.findMany({
    where: { deletedAt: null, isDemo: false, ...(opts.from || opts.to ? { createdAt } : {}) },
    select: {
      acquisitionChannel: true,
      acquisitionCampaign: true,
      stage: true,
      jobs: { where: { deletedAt: null }, select: { status: true, jobValue: true } },
    },
  });

  const key = (c: string, k: string) => (opts.byCampaign ? `${c}||${k}` : c);
  const rows = new Map<string, RoiRow>();
  const row = (channel: string, campaign: string) => {
    const k = key(channel, campaign);
    if (!rows.has(k)) rows.set(k, { channel, campaign: opts.byCampaign ? campaign : "", spend: 0, leads: 0, qualified: 0, bookings: 0, completed: 0, revenue: 0 });
    return rows.get(k)!;
  };

  for (const l of leads) {
    // Leads created before attribution existed are reported honestly.
    const r = row(l.acquisitionChannel ?? "Not tracked (older lead)", l.acquisitionCampaign ?? "");
    r.leads++;
    if (QUALIFIED_STAGES.includes(l.stage)) r.qualified++;
    const hasJob = l.jobs.some((j) => j.status !== "CANCELLED");
    if (BOOKED_STAGES.includes(l.stage) || hasJob) r.bookings++;
    const done = l.jobs.filter((j) => j.status === "COMPLETED");
    if (done.length) r.completed++;
    r.revenue += done.reduce((s, j) => s + (j.jobValue || 0), 0);
  }

  const months = (() => {
    if (!opts.from && !opts.to) return undefined;
    const f = (opts.from ?? new Date("2000-01-01")).toISOString().slice(0, 7);
    const t = (opts.to ?? new Date()).toISOString().slice(0, 7);
    return { gte: f, lte: t };
  })();
  const spend = await db.marketingSpend.findMany({ where: months ? { month: months } : {} });
  for (const s of spend) row(s.channel, s.campaign).spend += s.amount;

  return [...rows.values()].sort((a, b) => b.spend - a.spend || b.leads - a.leads);
}

export async function listMarketingSpend() {
  return db.marketingSpend.findMany({ orderBy: [{ month: "desc" }, { createdAt: "desc" }], take: 100 });
}
