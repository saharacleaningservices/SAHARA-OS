import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { FESTIVAL_CAMPAIGN_PATTERN } from "@/lib/attribution";

// Admin Marketing dashboard: spend → leads → interested → quotation → booking
// → completed → revenue, grouped by the lead's ORIGINAL acquisition channel
// (and campaign). Revenue = value of completed jobs linked to the lead.

const QUALIFIED_STAGES = ["INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION", "CONFIRMED", "JOB_SCHEDULED", "COMPLETED"];
const QUOTED_STAGES = ["QUOTATION", "NEGOTIATION", "CONFIRMED", "JOB_SCHEDULED", "COMPLETED"];
const BOOKED_STAGES = ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"];
export const NOT_TRACKED = "Not tracked (older lead)";

export type RoiRow = {
  channel: string;
  campaign: string;
  spend: number;
  leads: number;
  qualified: number;
  quoted: number;
  bookings: number;
  completed: number;
  revenue: number;
};

export type RoiFilters = {
  from?: Date;
  to?: Date;
  byCampaign?: boolean;
  channel?: string;
  campaign?: string;
  service?: string;
  stage?: string;
  festivalOnly?: boolean;
};

export async function getMarketingRoi(opts: RoiFilters) {
  const createdAt = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) };
  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
    isDemo: false,
    ...(opts.from || opts.to ? { createdAt } : {}),
    ...(opts.channel ? { acquisitionChannel: opts.channel === NOT_TRACKED ? null : opts.channel } : {}),
    ...(opts.campaign ? { acquisitionCampaign: opts.campaign } : {}),
    ...(opts.service ? { service: opts.service as never } : {}),
    ...(opts.stage ? { stage: opts.stage as never } : {}),
  };
  const leads = await db.lead.findMany({
    where,
    select: {
      acquisitionChannel: true,
      acquisitionCampaign: true,
      stage: true,
      _count: { select: { quotations: true } },
      jobs: { where: { deletedAt: null }, select: { status: true, jobValue: true } },
    },
  });

  const key = (c: string, k: string) => (opts.byCampaign ? `${c}||${k}` : c);
  const rows = new Map<string, RoiRow>();
  const row = (channel: string, campaign: string) => {
    const k = key(channel, campaign);
    if (!rows.has(k)) rows.set(k, { channel, campaign: opts.byCampaign ? campaign : "", spend: 0, leads: 0, qualified: 0, quoted: 0, bookings: 0, completed: 0, revenue: 0 });
    return rows.get(k)!;
  };

  for (const l of leads) {
    if (opts.festivalOnly && !FESTIVAL_CAMPAIGN_PATTERN.test(l.acquisitionCampaign ?? "")) continue;
    // Leads created before attribution existed are reported honestly.
    const r = row(l.acquisitionChannel ?? NOT_TRACKED, l.acquisitionCampaign ?? "");
    r.leads++;
    if (QUALIFIED_STAGES.includes(l.stage)) r.qualified++;
    if (QUOTED_STAGES.includes(l.stage) || l._count.quotations > 0) r.quoted++;
    const hasJob = l.jobs.some((j) => j.status !== "CANCELLED");
    if (BOOKED_STAGES.includes(l.stage) || hasJob) r.bookings++;
    const done = l.jobs.filter((j) => j.status === "COMPLETED");
    if (done.length) r.completed++;
    r.revenue += done.reduce((s, j) => s + (j.jobValue || 0), 0);
  }

  // Spend only applies to channel/campaign filters (not service/stage).
  if (!opts.service && !opts.stage) {
    const months = (() => {
      if (!opts.from && !opts.to) return undefined;
      const f = (opts.from ?? new Date("2000-01-01")).toISOString().slice(0, 7);
      const t = (opts.to ?? new Date()).toISOString().slice(0, 7);
      return { gte: f, lte: t };
    })();
    const spend = await db.marketingSpend.findMany({
      where: { ...(months ? { month: months } : {}), ...(opts.channel ? { channel: opts.channel } : {}), ...(opts.campaign ? { campaign: opts.campaign } : {}) },
    });
    for (const s of spend) {
      if (opts.festivalOnly && !FESTIVAL_CAMPAIGN_PATTERN.test(s.campaign)) continue;
      row(s.channel, s.campaign).spend += s.amount;
    }
  }

  return [...rows.values()].sort((a, b) => b.spend - a.spend || b.leads - a.leads);
}

export async function listMarketingSpend() {
  return db.marketingSpend.findMany({ orderBy: [{ month: "desc" }, { createdAt: "desc" }], take: 100 });
}

/** Distinct campaign names seen on leads or spend, for the filter dropdown. */
export async function listKnownCampaigns() {
  const [leads, spend] = await Promise.all([
    db.lead.findMany({ where: { acquisitionCampaign: { not: null }, deletedAt: null }, select: { acquisitionCampaign: true }, distinct: ["acquisitionCampaign"] }),
    db.marketingSpend.findMany({ where: { campaign: { not: "" } }, select: { campaign: true }, distinct: ["campaign"] }),
  ]);
  return [...new Set([...leads.map((l) => l.acquisitionCampaign!), ...spend.map((s) => s.campaign)])].sort();
}

export type WhatsAppCampaignRow = {
  campaign: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replied: number;
  leads: number;
  bookings: number;
  revenue: number;
};

/**
 * WhatsApp performance per campaign (template sends from the Marketing
 * dashboard carry relatedType "Campaign"; other template sends are grouped by
 * template name). Replied = the customer messaged us within 3 days of the
 * send. Leads/bookings/revenue = leads whose utm_campaign matches.
 */
export async function getWhatsAppCampaignStats(opts: { from?: Date; to?: Date }) {
  const createdAt = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) };
  const out = await db.whatsAppMessage.findMany({
    where: { direction: "OUTBOUND", templateName: { not: null }, ...(opts.from || opts.to ? { createdAt } : {}) },
    select: { toNumber: true, templateName: true, relatedType: true, relatedId: true, status: true, deliveredAt: true, readAt: true, createdAt: true },
  });
  if (!out.length) return [];
  const numbers = [...new Set(out.map((m) => m.toNumber))];
  const inbound = await db.whatsAppMessage.findMany({
    where: { direction: "INBOUND", toNumber: { in: numbers } },
    select: { toNumber: true, createdAt: true },
  });
  const byNumber = new Map<string, Date[]>();
  for (const i of inbound) byNumber.set(i.toNumber, [...(byNumber.get(i.toNumber) ?? []), i.createdAt]);

  const rows = new Map<string, WhatsAppCampaignRow>();
  for (const m of out) {
    const name = m.relatedType === "Campaign" && m.relatedId ? m.relatedId : `template: ${m.templateName}`;
    if (!rows.has(name)) rows.set(name, { campaign: name, sent: 0, delivered: 0, read: 0, failed: 0, replied: 0, leads: 0, bookings: 0, revenue: 0 });
    const r = rows.get(name)!;
    if (m.status === "SENT") r.sent++;
    if (m.status === "FAILED") r.failed++;
    if (m.deliveredAt) r.delivered++;
    if (m.readAt) r.read++;
    const end = m.createdAt.getTime() + 3 * 86400000;
    if ((byNumber.get(m.toNumber) ?? []).some((d) => d.getTime() > m.createdAt.getTime() && d.getTime() <= end)) r.replied++;
  }

  const campaigns = [...rows.keys()].filter((k) => !k.startsWith("template: "));
  if (campaigns.length) {
    const leads = await db.lead.findMany({
      where: { deletedAt: null, isDemo: false, OR: [{ acquisitionCampaign: { in: campaigns } }, { latestTouchCampaign: { in: campaigns } }] },
      select: { acquisitionCampaign: true, latestTouchCampaign: true, stage: true, jobs: { where: { deletedAt: null }, select: { status: true, jobValue: true } } },
    });
    for (const l of leads) {
      const r = rows.get(campaigns.includes(l.acquisitionCampaign ?? "") ? l.acquisitionCampaign! : l.latestTouchCampaign!);
      if (!r) continue;
      r.leads++;
      if (BOOKED_STAGES.includes(l.stage) || l.jobs.some((j) => j.status !== "CANCELLED")) r.bookings++;
      r.revenue += l.jobs.filter((j) => j.status === "COMPLETED").reduce((s, j) => s + (j.jobValue || 0), 0);
    }
  }
  return [...rows.values()].sort((a, b) => b.sent - a.sent);
}
