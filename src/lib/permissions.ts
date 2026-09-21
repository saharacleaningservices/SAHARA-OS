// Fine-grained permission rules layered on top of the section-level
// ROLE_NAV_ACCESS matrix in constants.ts. This comment describes roles, not
// specific people — the display name attached to a role in production isn't
// necessarily the name used in requirement docs/commit history, so don't
// treat names here as verified identity, only the role behavior is.
//
// Current access mapping (see ROLE_NAV_ACCESS in constants.ts for the exact
// section list per role — this is a summary, that's the source of truth):
// ADMIN — Super Admin, full access ("*").
// OPERATIONS — Operations Manager: Dashboard, Leads/CRM, Jobs (incl. Team
//   Dispatch), Staff, Vehicles, Attendance (view + operate the office
//   clock only — no calendar edit/backfill/bulk/month-close, per the
//   owner's 2026-09-21 decision), AMC, the filtered Housekeeping/Pest
//   Control/Interior Painting job views. NO payments/expenses/revenue/
//   profit/customers/reports/admin/settings.
// ACCOUNTS — Accounts & Operations Editor: full operational parity with
//   Super Admin (leads, jobs, dispatch, staff incl. salary/financials/
//   documents, vehicles, attendance incl. calendar edit, AMC, payments,
//   expenses, customers, reports, gallery, trash, revenue dashboard,
//   WhatsApp Log — kept for Accounts per the owner's explicit decision,
//   Owner Command Center home). NO security, NO device/security approvals,
//   NO audit log, NO profit dashboard, NO system settings — owner-only.
// SUPERVISOR — Field Coordinator: today's & tomorrow's own jobs, own
//   attendance, mobile-first.
// STAFF — Field Staff: own jobs/attendance only, mobile-first.

export type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

/** Staff wages/salary figures — Super Admin + Accounts (full Staff module access). */
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

/** Create / edit / delete / assign jobs and leads (vs. only progressing them). */
export function canManageJobs(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Soft-delete individual records (leads, jobs, payments, expenses). */
export function canDeleteRecords(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Company settings, backups, logo/branding. */
export function canManageSettings(role: string): boolean {
  return role === "ADMIN";
}

/** Audit log, trash/restore, bulk delete, "delete all demo data". */
export function canManageDataSafety(role: string): boolean {
  return role === "ADMIN";
}

/** Cross-module global search + full customer database browsing/export. */
export function canSearchGlobally(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

export function canExportCustomers(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Vehicle & material allocation. */
export function canAllocateResources(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
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
  if (role === "OPERATIONS") return "TODAY_TOMORROW"; // Francis: dispatch-only, today + tomorrow
  if (role === "SUPERVISOR") return "TODAY_TOMORROW"; // Field Coordinator: today + tomorrow, all teams
  if (role === "STAFF") return "OWN_TODAY";
  return "ALL"; // ADMIN, ACCOUNTS
}

// Phase 3 — Revenue, WhatsApp & Workforce Automation

/** Revenue dashboard + revenue/collections tiles. Super Admin + Accounts (Profit stays owner-only). */
export function canViewRevenue(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** AMC contracts — Super Admin + Accounts. */
export function canManageAmc(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
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
