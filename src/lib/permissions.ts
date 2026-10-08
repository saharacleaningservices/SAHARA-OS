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
// SUPERVISOR — Field Coordinator (Francis): SUPERSEDED 2026-09-21 — an
//   explicit "IMPORTANT POLICY OVERRIDE" from the owner replaced the
//   earlier-that-day "identical to OPERATIONS" policy with a deliberately
//   narrower one. Now: Dashboard, Leads/CRM, Jobs (incl. Team Dispatch),
//   Staff, Vehicles, Attendance ONLY — no AMC, Payments, Expenses,
//   Housekeeping/Pest Control/Interior Painting, Customers database,
//   Reports, AI Assistant, Gallery, Trash. Within Jobs/Leads: view+edit
//   scoped to today/tomorrow (canAccessJob / lead scoping in server/
//   leads.ts), past records view-only, nothing beyond tomorrow. Staff/
//   Attendance: operational info only — salary/wage/payroll/bank details/
//   private documents all hidden (same canViewSalary gate as everyone
//   else who isn't ADMIN/ACCOUNTS, now also fixed to hide bank/GPay
//   details it had accidentally been leaking to every role). May still
//   send a customer Booking Form/Review/Payment link and Call/WhatsApp
//   from a Job/Lead's own detail page — sending a payment link is not the
//   same as Payments-module access, and isn't gated by it.
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

/**
 * Create / edit / assign jobs and leads (vs. only progressing them). Delete
 * stays separate — see canDeleteRecords. SUPERVISOR keeps this (Francis
 * still edits jobs/leads day to day) but is further time-scoped to
 * today/tomorrow at the record level — see canAccessJob (server/jobs.ts)
 * and the equivalent Lead scoping (server/leads.ts), not here.
 */
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

/**
 * Restore an individual soft-deleted record from Trash — deliberately
 * broader than canManageDataSafety's bulk/destructive actions, since
 * undoing one accidental delete isn't the same risk as bulk-wiping demo
 * data. SUPERVISOR removed 2026-09-21 — Trash isn't part of Francis's
 * narrowed module list.
 */
export function canRestoreRecords(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS";
}

/**
 * Cross-module global search + full customer database browsing/export.
 * SUPERVISOR removed 2026-09-21 — this bundles unrestricted customer
 * database access, which Francis's narrowed policy explicitly forbids
 * ("must NOT have unrestricted access to the Customers database").
 */
export function canSearchGlobally(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** OPERATIONS removed 2026-09-25 (Francis's field-only policy) — global
 *  search/export both surface customer name + mobile, which he must never
 *  see. Same reasoning SUPERVISOR was removed 2026-09-21. */
export function canExportCustomers(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Vehicle & material allocation. SUPERVISOR keeps this — Vehicles stays in Francis's narrowed 2026-09-21 module list, needed for Team Dispatch. */
export function canAllocateResources(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS" || role === "SUPERVISOR";
}

/**
 * How far a role's job list reaches:
 * - ALL: every job (Admin, Accounts)
 * - YESTERDAY_TODAY_TOMORROW: only jobs scheduled yesterday, today or
 *   tomorrow (Operations — Francis, owner rule 2026-10-06)
 * - TODAY_TOMORROW: only jobs scheduled today or tomorrow (Field Coordinator)
 * - OWN_TODAY_TOMORROW: only jobs the user supervises or is assigned to,
 *   AND only if scheduled today or tomorrow
 * - OWN_TODAY: only the user's own jobs scheduled today (Worker)
 */
export type JobScope = "ALL" | "YESTERDAY_TODAY_TOMORROW" | "TODAY_TOMORROW" | "OWN_TODAY_TOMORROW" | "OWN_TODAY";

export function jobScopeFor(role: string): JobScope {
  if (role === "OPERATIONS") return "YESTERDAY_TODAY_TOMORROW"; // Francis: yesterday + today + tomorrow, all teams
  if (role === "SUPERVISOR") return "TODAY_TOMORROW"; // Field Coordinator: today + tomorrow, all teams
  if (role === "STAFF") return "OWN_TODAY";
  return "ALL"; // ADMIN, ACCOUNTS
}

// Phase 3 — Revenue, WhatsApp & Workforce Automation

/** Revenue dashboard + revenue/collections tiles. Super Admin + Accounts (Profit stays owner-only). */
/**
 * Per-job amount, paid and balance on the Jobs list / job page — owner
 * request 2026-10-05 so Francis can run jobs without calling the office.
 * Operational only: no revenue totals, profit, margin, expenses or staff cost
 * (those stay behind canViewRevenue / canViewFinancials). Field Staff see
 * their own jobs' amounts in the Staff App (server/staff-portal.ts).
 */
export function canViewJobAmount(role: string): boolean {
  // Owner rule 2026-10-08 (supersedes 2026-10-05): Operations (Francis) sees no
  // job amount / advance / balance — operational data only.
  return role === "ADMIN" || role === "ACCOUNTS";
}

/**
 * Customer mobile / alternate mobile / WhatsApp number / email. Owner rule
 * 2026-10-08: Super Admin + Accounts only — never Operations (Francis), the
 * Field Coordinator or Field Staff, in any view, payload, PDF or notification.
 * Data stays in the database; this is role-based visibility only.
 */
export function canSeeCustomerContact(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

export function canViewRevenue(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/**
 * AMC contracts — full edit access per the 2026-09-21 role policy.
 * SUPERVISOR removed the same day (later same-day policy override) — AMC
 * isn't part of Francis's narrowed module list.
 */
export function canManageAmc(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS";
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
