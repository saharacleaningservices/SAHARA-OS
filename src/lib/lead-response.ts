// Lead Response Timer: a lead still in stage NEW after 15 minutes is "uncontacted" — red on screen, alert to Accounts/Admin.
export const LEAD_RESPONSE_SLA_MS = 15 * 60 * 1000;

export function leadWaitMs(createdAt: Date | string, now = Date.now()): number {
  return Math.max(0, now - new Date(createdAt).getTime());
}

/** True for a NEW (not yet worked) lead older than the SLA. */
export function isLeadResponseOverdue(stage: string, createdAt: Date | string, now = Date.now()): boolean {
  return stage === "NEW" && leadWaitMs(createdAt, now) >= LEAD_RESPONSE_SLA_MS;
}

export function formatWait(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`;
}
