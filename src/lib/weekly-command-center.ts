// Weekly Command Center (owner 2026-11-14) — pure, unit-tested computation (tests/weekly-command-center.test.ts).
// The server (src/server/owner-command-center.ts → getWeeklyCommandCenter) only fetches rows; every number is computed here.
//
// Definitions (IST calendar weeks, Monday 00:00 → next Monday 00:00 IST; "This Week" is week-to-date):
//  - Leads              : leads created in the week (not deleted, not demo).
//  - Confirmed Bookings : jobs created in the week (a job exists only once a booking is confirmed).
//  - Completed Jobs     : jobs with status COMPLETED whose completedAt falls in the week.
//  - Gross Revenue      : sum of jobValue of those completed jobs (final payable incl. GST/discount).
//  - Net Collected      : money actually received — Payment rows with paidDate in the week (paidAmount), split by mode:
//                         UPI (UPI / QR), Cash (CASH), Other (BANK / unknown).
//  - AOV                : Gross Revenue ÷ Completed Jobs.
//  - Cross-Sell Revenue : add-on lines on completed jobs — see crossSellOf below.
//  - Lead Sources       : leads in the week grouped by Lead.source.
//  - Start Code compliance: of completed jobs that were issued a startOtp, the % with startOtpVerifiedAt set.
import { IST_MS, istDayKey } from "@/lib/ist-days";
import { lineAmount, parsePackage } from "@/lib/package-calc";
import { PRICING_MASTER } from "@/lib/pricing-master";

const DAY_MS = 24 * 3600 * 1000;

export type IstWeek = { from: Date; to: Date; label: string };

/** The IST Monday–Sunday week containing `now`, or `weeksBack` weeks before it. `to` is exclusive. */
export function istWeekRange(now: Date, weeksBack = 0): IstWeek {
  const [y, m, d] = istDayKey(now).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const mondayUtc = Date.UTC(y, m - 1, d - ((dow + 6) % 7) - 7 * weeksBack);
  const from = new Date(mondayUtc - IST_MS);
  const to = new Date(from.getTime() + 7 * DAY_MS);
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return { from, to, label: `${fmt(mondayUtc)} – ${fmt(mondayUtc + 6 * DAY_MS)}` };
}

/**
 * Cross-sell services (Price Master content ids). A line counts as cross-sell only when it is NOT the main service of the booking.
 * Same-service variants are included (SCS-37 double-door fridge next to SCS-32, SCS-33 kitchen-with-utensils next to SCS-12).
 */
export const CROSS_SELL_IDS: ReadonlySet<string> = new Set([
  "SCS-35", // Chimney Deep Cleaning
  "SCS-32", // Single Door Fridge Deep Cleaning
  "SCS-37", // Double Door Fridge Deep Cleaning
  "SCS-36", // Kitchen Pest Control (add-on)
  "SCS-09", // Sofa Shampooing
  "SCS-11", // Mattress Cleaning
  "SCS-12", // Kitchen Deep Cleaning (Without Chimney)
  "SCS-33", // Kitchen Deep Cleaning (Utensil removal & placing back)
  "SCS-10", // Bathroom Deep Cleaning
]);

export type CrossSellSource = { serviceItems?: string | null; lead?: { serviceItems?: string | null; addOnServices?: string | null } | null };

/** "Chimney Deep Cleaning × 2" (booking-form add-on label) → priced from the Price Master; unknown names count ₹0. */
function addOnLabelValue(label: string): number {
  const m = label.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/i);
  const name = (m ? m[1] : label).trim().toLowerCase();
  const qty = m ? Number(m[2]) : 1;
  const item = PRICING_MASTER.find((p) => p.name.toLowerCase() === name);
  if (!item || !CROSS_SELL_IDS.has(item.contentId) || item.price == null) return 0;
  return item.price * Math.max(1, qty);
}

/**
 * Cross-sell value of one booking (simple, documented rule):
 *  1. Use the job's package lines (serviceItems), else the lead's. The FIRST chargeable line is the main service and never counts;
 *     every later chargeable line whose contentId is in CROSS_SELL_IDS counts at its line amount (qty × unit price as booked).
 *     Complimentary lines never count.
 *  2. If neither has package lines, use the lead's booking-form add-ons (addOnServices, e.g. "Chimney Deep Cleaning × 1"), which are
 *     by definition picked on top of a main package: each one in CROSS_SELL_IDS counts at the Price Master price × qty.
 */
export function crossSellOf(j: CrossSellSource): number {
  const pkg = parsePackage(j.serviceItems || j.lead?.serviceItems || null);
  const lines = pkg.lines.filter((l) => !l.complimentary);
  if (lines.length) {
    return Math.round(lines.slice(1).reduce((s, l) => s + (l.contentId && CROSS_SELL_IDS.has(l.contentId) ? lineAmount(l) : 0), 0) * 100) / 100;
  }
  let addOns: unknown = [];
  try { addOns = JSON.parse(j.lead?.addOnServices || "[]"); } catch { addOns = []; }
  if (!Array.isArray(addOns)) return 0;
  return addOns.reduce((s: number, a) => s + (typeof a === "string" ? addOnLabelValue(a) : 0), 0);
}

export type PaymentBucket = "UPI" | "CASH" | "OTHER";
export const paymentBucket = (mode: string | null | undefined): PaymentBucket => {
  const m = (mode ?? "").toUpperCase();
  if (m === "UPI" || m === "QR") return "UPI";
  if (m === "CASH") return "CASH";
  return "OTHER";
};

export type CcLead = { createdAt: Date; source: string };
export type CcJobCreated = { createdAt: Date };
export type CcCompletedJob = CrossSellSource & { completedAt: Date | null; jobValue: number; startOtp: string | null; startOtpVerifiedAt: Date | null };
export type CcPayment = { paidDate: Date | null; paidAmount: number; mode: string | null };
export type CcInput = { leads: CcLead[]; jobsCreated: CcJobCreated[]; completed: CcCompletedJob[]; payments: CcPayment[] };

export type WeekMetrics = {
  leads: number;
  confirmedBookings: number;
  completedJobs: number;
  grossRevenue: number;
  netCollected: number;
  collectedUpi: number;
  collectedCash: number;
  collectedOther: number;
  aov: number;
  crossSellRevenue: number;
  crossSellJobs: number;
  leadSources: { source: string; count: number }[];
  otpIssued: number;
  otpVerified: number;
  /** % of completed jobs with a start code that were verified; null when none were issued. */
  otpCompliance: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const inWeek = (d: Date | null | undefined, w: IstWeek) => !!d && d.getTime() >= w.from.getTime() && d.getTime() < w.to.getTime();

export function weekMetrics(input: CcInput, w: IstWeek): WeekMetrics {
  const leads = input.leads.filter((l) => inWeek(l.createdAt, w));
  const completed = input.completed.filter((j) => inWeek(j.completedAt, w));
  const payments = input.payments.filter((p) => inWeek(p.paidDate, w) && p.paidAmount > 0);
  const grossRevenue = r2(completed.reduce((s, j) => s + (j.jobValue || 0), 0));
  const by = (b: PaymentBucket) => r2(payments.filter((p) => paymentBucket(p.mode) === b).reduce((s, p) => s + p.paidAmount, 0));
  const crossSell = completed.map(crossSellOf);
  const sourceCounts = new Map<string, number>();
  for (const l of leads) sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1);
  const otpIssued = completed.filter((j) => j.startOtp).length;
  const otpVerified = completed.filter((j) => j.startOtp && j.startOtpVerifiedAt).length;
  const collectedUpi = by("UPI");
  const collectedCash = by("CASH");
  const collectedOther = by("OTHER");
  return {
    leads: leads.length,
    confirmedBookings: input.jobsCreated.filter((j) => inWeek(j.createdAt, w)).length,
    completedJobs: completed.length,
    grossRevenue,
    netCollected: r2(collectedUpi + collectedCash + collectedOther),
    collectedUpi,
    collectedCash,
    collectedOther,
    aov: completed.length ? Math.round(grossRevenue / completed.length) : 0,
    crossSellRevenue: r2(crossSell.reduce((s, n) => s + n, 0)),
    crossSellJobs: crossSell.filter((n) => n > 0).length,
    leadSources: [...sourceCounts].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
    otpIssued,
    otpVerified,
    otpCompliance: otpIssued ? Math.round((otpVerified / otpIssued) * 1000) / 10 : null,
  };
}

/** % change this vs last; null when last week is 0 (no meaningful percentage). */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type CommandCenter = { thisWeek: IstWeek & { m: WeekMetrics }; lastWeek: IstWeek & { m: WeekMetrics } };

/** Both weeks from one row set (rows outside both weeks are ignored). */
export function buildWeeklyCommandCenter(input: CcInput, now: Date): CommandCenter {
  const tw = istWeekRange(now, 0);
  const lw = istWeekRange(now, 1);
  return { thisWeek: { ...tw, m: weekMetrics(input, tw) }, lastWeek: { ...lw, m: weekMetrics(input, lw) } };
}
