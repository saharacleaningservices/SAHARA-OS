// Fine-grained permission rules layered on top of the section-level
// ROLE_NAV_ACCESS matrix in constants.ts.
//
// Current access mapping:
// ADMIN — Altaf Shaikh (admin@) — Super Admin, full access
// OPERATIONS — Francis Monteiro (operations@) — dispatch-only: today's &
//   tomorrow's jobs, view + edit. Nothing else.
// ACCOUNTS — Shoyab "Shoaib" Shaikh (accounts@) — full operational parity
//   with Super Admin (leads, jobs, dispatch, staff incl. salary/financials/
//   documents, vehicles, attendance, AMC, payments, expenses, customers,
//   reports, gallery, trash, revenue dashboard, Owner Command Center home).
//   NO security, NO device/security approvals, NO audit log, NO profit
//   dashboard, NO WhatsApp log, NO system settings — owner-only.
// SUPERVISOR — Suresh Pawar (supervisor@) — Field Coordinator
// STAFF — Vikas Shinde (staff@) — Field Staff (mobile only)
// Login emails & passwords are unchanged; only role permissions changed.

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

/** WhatsApp send log resend controls (viewing the log page itself is gated separately by role on the page). Super Admin only — owner-only per access spec. */
export function canViewWhatsAppLog(role: string): boolean {
  return role === "ADMIN";
}
