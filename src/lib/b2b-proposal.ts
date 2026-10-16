// B2B facility-management / housekeeping AMC proposal builder (pure — no DB, no network).
// Turns a short site brief into quotation line items + a scope-of-work and terms text that the
// existing Quotation (and its PDF) carries. Rates are always typed in by Admin/Accounts — nothing
// here prices a job. The default terms are a DRAFT: the owner approves them before customer use.

export const SITE_TYPES = ["OFFICE", "SOCIETY", "COMMERCIAL"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const SITE_TYPE_LABEL: Record<SiteType, string> = {
  OFFICE: "Corporate office",
  SOCIETY: "Residential society",
  COMMERCIAL: "Commercial complex / retail",
};

export type StaffLine = { role: string; count: number; monthlyRate: number };

export type B2bBrief = {
  siteType: SiteType;
  siteName: string;
  siteAddress?: string;
  areaSqft?: number;
  daysPerWeek: number; // 1–7
  shiftHours: number; // per shift, 4–12
  staff: StaffLine[];
  consumablesByClient: boolean; // true = client supplies chemicals/consumables
  contractMonths: number; // 1–36
  extraScope?: string; // free text added by staff
  terms?: string; // edited terms; default = DRAFT_B2B_TERMS
};

/** Typical tasks per site type — editable in the dialog through extraScope. */
const SCOPE_BY_SITE: Record<SiteType, { daily: string[]; weekly: string[]; monthly: string[] }> = {
  OFFICE: {
    daily: ["Sweeping and wet mopping of all work areas", "Desk, chair and workstation dusting", "Washroom cleaning and replenishment", "Pantry and cafeteria cleaning", "Garbage collection and segregation"],
    weekly: ["Glass partitions and doors", "Skirting, switchboards and fixtures", "Deep cleaning of washrooms"],
    monthly: ["Window panes (reachable height)", "Upholstery vacuuming", "Ceiling fans and light fittings"],
  },
  SOCIETY: {
    daily: ["Lobby, entrance and staircase sweeping and mopping", "Lift cleaning (cabin and doors)", "Common-area garbage collection and segregation", "Security cabin and clubhouse cleaning"],
    weekly: ["Staircase railings and walls", "Parking area sweeping", "Common washrooms deep cleaning"],
    monthly: ["Terrace and overhead areas", "Notice boards, signage and light fittings"],
  },
  COMMERCIAL: {
    daily: ["Common areas, corridors and atrium cleaning", "Washrooms cleaning and replenishment", "Escalator/lift cleaning", "Food court / pantry cleaning", "Garbage collection and segregation"],
    weekly: ["Glass facades (inside, reachable height)", "Parking and service areas", "Deep cleaning of washrooms"],
    monthly: ["High dusting", "Signage, fixtures and light fittings"],
  },
};

/** DRAFT — owner approval required before customer use (CLAUDE.md: pricing/terms are owner decisions). */
export const DRAFT_B2B_TERMS = [
  "1. Monthly billing in advance; GST extra as applicable.",
  "2. Staff are Sahara Cleaning Services employees, trained and supervised by Sahara.",
  "3. An absent staff member is replaced the same shift wherever possible.",
  "4. Either party may end the contract with 30 days' written notice.",
  "5. Rates are reviewed at contract renewal.",
  "6. This proposal is valid for 15 days from the date of issue.",
].join("\n");

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

export type B2bValidation = { ok: true } | { ok: false; error: string };

export function validateBrief(b: B2bBrief): B2bValidation {
  if (!SITE_TYPES.includes(b.siteType)) return { ok: false, error: "Pick a site type" };
  if (!b.siteName?.trim()) return { ok: false, error: "Site name is required" };
  if (!Array.isArray(b.staff) || b.staff.length === 0) return { ok: false, error: "Add at least one staff line" };
  for (const s of b.staff) {
    if (!s.role?.trim()) return { ok: false, error: "Each staff line needs a role" };
    if (!Number.isFinite(s.count) || s.count < 1 || s.count > 200) return { ok: false, error: `Invalid head-count for ${s.role}` };
    if (!Number.isFinite(s.monthlyRate) || s.monthlyRate <= 0) return { ok: false, error: `Enter the monthly rate for ${s.role}` };
  }
  return { ok: true };
}

/** Line items for one month of service (the quotation total = monthly charge before GST). */
export function proposalItems(b: B2bBrief) {
  return b.staff.map((s) => {
    const count = clampInt(s.count, 1, 200);
    return {
      name: `${s.role.trim()} × ${count}`,
      description: `${count} × ${s.role.trim()} @ ₹${Math.round(s.monthlyRate).toLocaleString("en-IN")}/month · ${clampInt(b.daysPerWeek, 1, 7)} days/week, ${clampInt(b.shiftHours, 4, 12)} h shift`,
      amount: Math.round(count * s.monthlyRate * 100) / 100,
    };
  });
}

/** Scope of work + terms, as one text block (the Quotation's terms field; line breaks print in the PDF). */
export function proposalTerms(b: B2bBrief): string {
  const scope = SCOPE_BY_SITE[b.siteType];
  const months = clampInt(b.contractMonths, 1, 36);
  const lines = [
    `FACILITY MANAGEMENT / HOUSEKEEPING AMC PROPOSAL — ${SITE_TYPE_LABEL[b.siteType]}`,
    `Site: ${b.siteName.trim()}${b.siteAddress?.trim() ? `, ${b.siteAddress.trim()}` : ""}${b.areaSqft ? ` · approx. ${Math.round(b.areaSqft).toLocaleString("en-IN")} sq ft` : ""}`,
    `Schedule: ${clampInt(b.daysPerWeek, 1, 7)} days/week, ${clampInt(b.shiftHours, 4, 12)}-hour shift · Contract: ${months} month${months === 1 ? "" : "s"}`,
    `Staffing: ${b.staff.map((s) => `${clampInt(s.count, 1, 200)} × ${s.role.trim()}`).join(", ")}`,
    "",
    "SCOPE OF WORK",
    "Daily: " + scope.daily.join("; ") + ".",
    "Weekly: " + scope.weekly.join("; ") + ".",
    "Monthly: " + scope.monthly.join("; ") + ".",
    ...(b.extraScope?.trim() ? ["Additional: " + b.extraScope.trim()] : []),
    `Consumables and chemicals: ${b.consumablesByClient ? "supplied by the client" : "supplied by Sahara Cleaning Services (included in the monthly charge)"}.`,
    "Excluded unless agreed in writing: work at height beyond reachable levels, facade cleaning, pest control, repairs.",
    "",
    "TERMS",
    (b.terms?.trim() || DRAFT_B2B_TERMS),
  ];
  return lines.join("\n").slice(0, 6000);
}
