import { activeCampaign, upcomingFestivals, type FestivalWindow } from "@/lib/pricing-master";

// Festival booking urgency for the public landing pages. Everything shown is derived from the festival windows the
// owner sets in Settings → Pricing (the same windows that switch festival prices on), so the dates and the
// "festival prices apply" statement are always true. No invented slot counts and no price-hike amounts.

export type FestivalUrgency = { start: string; end: string; label: string; running: boolean };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-25" → "25 Oct". */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}

/** The festival campaign span (running now, or the next upcoming window), or null when none is configured. */
export function festivalUrgency(festivals: FestivalWindow[], todayYmd: string): FestivalUrgency | null {
  const campaign = activeCampaign(festivals, todayYmd);
  if (campaign) return { start: campaign.start, end: campaign.end, label: `${shortDate(campaign.start)} – ${shortDate(campaign.end)}`, running: true };
  const next = upcomingFestivals(festivals, todayYmd);
  if (!next.length) return null;
  const start = next[0].start;
  const end = next.reduce((e, f) => (f.end > e ? f.end : e), next[0].end);
  return { start, end, label: `${shortDate(start)} – ${shortDate(end)}`, running: false };
}
