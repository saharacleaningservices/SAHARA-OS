// Vendor commission split (owner 2026-11-04): Sahara keeps 20–25 % of the job value
// (default 20 %), the vendor gets the rest (75–80 %). Whole rupees — Sahara's share is
// rounded half-up, the vendor gets the exact remainder, so the two always add up.
export const COMMISSION_MIN = 20;
export const COMMISSION_MAX = 25;
export const COMMISSION_DEFAULT = 20;

export function clampCommission(pct: unknown): number {
  const n = typeof pct === "string" ? Number(pct) : typeof pct === "number" ? pct : NaN;
  if (!Number.isFinite(n)) return COMMISSION_DEFAULT;
  return Math.min(COMMISSION_MAX, Math.max(COMMISSION_MIN, Math.round(n * 10) / 10));
}

export type CommissionSplit = { gross: number; commissionPct: number; saharaShare: number; vendorShare: number; vendorPct: number };

export function splitCommission(gross: number, pct: unknown = COMMISSION_DEFAULT): CommissionSplit {
  const g = Number.isFinite(gross) && gross > 0 ? Math.round(gross) : 0;
  const commissionPct = clampCommission(pct);
  const saharaShare = Math.round((g * commissionPct) / 100);
  return { gross: g, commissionPct, saharaShare, vendorShare: g - saharaShare, vendorPct: Math.round((100 - commissionPct) * 10) / 10 };
}
