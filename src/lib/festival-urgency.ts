// Festival demand notice for the public landing pages. The window is the owner's own statement of when service
// dates are busiest (2026-10-20); it carries no slot counts and no price-rise figure, so everything shown is true.
// Update DEMAND_WINDOW each festival season — after `end` the notice disappears by itself.

export const DEMAND_WINDOW = { start: "2026-10-21", end: "2026-11-08" } as const;

export type FestivalUrgency = { start: string; end: string; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-25" → "25 Oct". */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}

/** The demand window while it is still running or ahead, otherwise null. */
export function festivalUrgency(todayYmd: string, window: { start: string; end: string } = DEMAND_WINDOW): FestivalUrgency | null {
  if (todayYmd > window.end) return null;
  return { start: window.start, end: window.end, label: `${shortDate(window.start)} – ${shortDate(window.end)}` };
}
