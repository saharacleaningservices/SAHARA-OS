// Fine-grained permission rules layered on top of the section-level
// ROLE_NAV_ACCESS matrix in constants.ts. This comment describes roles, not
// specific people — the display name attached to a role in production isn't
// necessarily the name used in requirement docs/commit history, so don't
// treat names here as verified identity, only the role behavior is.
//
// Current access mapping (see ROLE_NAV_ACCESS in constants.ts for the exact
// section list per role — this is a summary, that's the source of truth):
// ADMIN — Super Admin, full access ("*").
// OPERATIONS — Operations Manager: full day-to-day operational access —
//   Dashboard, Leads/CRM, Jobs (incl. Team Dispatch), Staff, Vehicles,
//   Attendance (view + operate the office clock only — no calendar edit/
//   backfill/bulk/month-close), AMC, Payments (record/edit, no owner
//   financial settings), Expenses (add/edit operational categories, no
//   owner financial controls), the filtered Housekeeping/Pest Control/
//   Interior Painting job views, Customers, Reports, AI Assistant, Gallery,
//   Trash (restore only, never permanent/bulk delete) — per the owner's
//   2026-09-21 final role policy. NO Revenue Dashboard, NO Profit, NO staff
//   salary/wage figures, NO User Management/Audit Log/Security or Device
//   Approvals, NO WhatsApp Log, NO system settings.
// ACCOUNTS — Accounts & Operations Editor: full operational parity with
//   Super Admin (leads, jobs, dispatch, staff incl. salary/financials/
//   documents, vehicles, attendance incl. calendar edit, AMC, payments,
//   expenses, customers, reports, gallery, trash, revenue dashboard,
//   WhatsApp Log — kept for Accounts per the owner's explicit decision,
//   Owner Command Center home). NO security, NO device/security approvals,
//   NO audit log, NO profit dashboard, NO system settings — owner-only.
// SUPERVISOR — Field Coordinator: same full operational access as
//   OPERATIONS above, per the owner's 2026-09-21 decision that both roles
//   get identical day-to-day capability (previously scoped to only
//   today/tomorrow's own jobs — that job-list scope itself is unchanged,
//   see jobScopeFor below, only the module/feature access was widened).
// STAFF — Field Staff: own jobs/attendance only, mobile-first.

export type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

/** Staff wages/salary figures — Super Admin + Accounts only (not part of the 2026-09-21 Operations/Supervisor expansion — salary stays a step above general "Staff module" access). */
export function canViewSalary(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Profit dashboard (revenue − expenses − wages). Super Admin only. */
export function canViewFinancials(role: string): boolean {
  return role === "ADMIN";
}

/** Security: device approvals, OTP relay, audit log, user/role management. Super Admin only. */
export function canManageSecurity(role: string): boolean {
  return role === "ADMIN";
}

/** Create / edit / assign jobs and leads (vs. only progressing them). Delete stays separate — see canDeleteRecords. */
export function canManageJobs(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/** Soft-delete individual records (leads, jobs, payments, expenses) — owner-controlled, unchanged by the 2026-09-21 Operations/Supervisor expansion (that expansion granted edit/restore, not delete). */
export function canDeleteRecords(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Company settings, backups, logo/branding. */
export function canManageSettings(role: string): boolean {
  return role === "ADMIN";
}

/** Bulk/destructive data-safety actions only ("delete all demo data") — Super Admin only. Restoring an individual record from Trash is a separate, less sensitive action — see canRestoreRecords. */
export function canManageDataSafety(role: string): boolean {
  return role === "ADMIN";
}

/** Restore an individual soft-deleted record from Trash — deliberately broader than canManageDataSafety's bulk/destructive actions, since undoing one accidental delete isn't the same risk as bulk-wiping demo data. */
export function canRestoreRecords(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/** Cross-module global search + full customer database browsing/export. */
export function canSearchGlobally(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

export function canExportCustomers(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/** Vehicle & material allocation. */
export function canAllocateResources(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/**
 * How far a role's job list reaches:
 * - ALL: every job (Admin, Accounts)
 * - TODAY_TOMORROW: only jobs scheduled today or tomorrow (Operations —
 *   Francis — and Field Coordinator)
 * - OWN_TODAY_TOMORROW: only jobs the user supervises or is assigned to,
 *   AND only if scheduled today or tomorrow
 * - OWN_TODAY: only the user's own jobs scheduled today (Worker)
 */
export type JobScope = "ALL" | "TODAY_TOMORROW" | "OWN_TODAY_TOMORROW" | "OWN_TODAY";

export function jobScopeFor(role: string): JobScope {
  if (role === "OPERATIONS") return "TODAY_TOMORROW"; // Operations Manager: dispatch-focused, today + tomorrow
  if (role === "SUPERVISOR") return "TODAY_TOMORROW"; // Field Coordinator: today + tomorrow, all teams
  if (role === "STAFF") return "OWN_TODAY";
  return "ALL"; // ADMIN, ACCOUNTS
}

// Phase 3 — Revenue, WhatsApp & Workforce Automation

/** Revenue dashboard + revenue/collections tiles. Super Admin + Accounts (Profit stays owner-only). */
export function canViewRevenue(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** AMC contracts — full edit access per the 2026-09-21 role policy. */
export function canManageAmc(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/** Upsell combo rules — Admin configures them; everyone can see them offered in booking. */
export function canManageUpsellRules(role: string): boolean {
  return role === "ADMIN";
}

/** Advances/fines/rewards against a staff member's pay — Super Admin + Accounts (full Staff module access). */
export function canManageStaffFinancials(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Full attendance list + admin-side corrections (Worker only sees/marks their own). */
export function canManageAttendance(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/**
 * Reserved for a future per-message "resend" action on the Message Log page
 * — currently unused (no caller; the page has no resend button yet). Do NOT
 * use this to gate viewing the log page itself: that's `requireRole(["ADMIN",
 * "ACCOUNTS"])` on the page plus `"whatsapp-log"` in `ROLE_NAV_ACCESS` (both
 * ADMIN + ACCOUNTS, per the owner's explicit decision on requirement #15).
 */
export function canViewWhatsAppLog(role: string): boolean {
  return role === "ADMIN";
}
