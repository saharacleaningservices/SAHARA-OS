// Fine-grained permission rules layered on top of the section-level
// ROLE_NAV_ACCESS matrix in constants.ts.
//
// Roles (2026-09 assignment):
//   ADMIN       — Altaf Shaikh (admin@)          — full access
//   OPERATIONS  — Shoyab Shaikh (accounts@)      — Operations Manager
//   SUPERVISOR  — Francis D'Souza (operations@)  — Field Coordinator
//   STAFF       — Vikas Shinde (staff@)          — Worker
//   ACCOUNTS    — no current holder
// Login emails are unchanged; only the role each account carries changed.

export type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

/** Admin only — staff wages/salary figures. */
export function canViewSalary(role: string): boolean {
  return role === "ADMIN";
}

/** Profit dashboard (revenue − expenses). Admin / Accountant only. */
export function canViewFinancials(role: string): boolean {
  return role === "ADMIN" || role === "ACCOUNTS";
}

/** Create / edit / delete / assign jobs and leads (vs. only progressing them). */
export function canManageJobs(role: string): boolean {
  return role === "ADMIN" || role === "OPERATIONS";
}

/** Soft-delete individual records (leads, jobs, payments, expenses). */
export function canDeleteRecords(role: string): boolean {
  return role === "ADMIN" || role === "OPERATIONS";
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
  return role === "ADMIN" || role === "OPERATIONS";
}

/**
 * How far a role's job list reaches:
 * - ALL: every job (Admin)
 * - TODAY_TOMORROW: only jobs scheduled today or tomorrow (Operations Manager)
 * - OWN_TODAY_TOMORROW: only jobs the user supervises or is assigned to,
 *   AND only if scheduled today or tomorrow (Field Supervisor — "Allow
 *   ONLY: Today's jobs, Tomorrow's jobs")
 * - OWN_TODAY: only the user's own jobs scheduled today (Worker)
 */
export type JobScope = "ALL" | "TODAY_TOMORROW" | "OWN_TODAY_TOMORROW" | "OWN_TODAY";

export function jobScopeFor(role: string): JobScope {
  // Operations Manager schedules and oversees every job → ALL.
  if (role === "SUPERVISOR") return "TODAY_TOMORROW"; // Field Coordinator: today + tomorrow, all teams
  if (role === "STAFF") return "OWN_TODAY";
  return "ALL";
}

// Phase 3 — Revenue, WhatsApp & Workforce Automation

/** Revenue dashboard + revenue/collections tiles. Admin + Operations Manager. */
export function canViewRevenue(role: string): boolean {
  return role === "ADMIN" || role === "OPERATIONS" || role === "ACCOUNTS";
}

/** AMC contracts — office roles that deal with customers/scheduling. */
export function canManageAmc(role: string): boolean {
  return role === "ADMIN" || role === "OPERATIONS" || role === "ACCOUNTS";
}

/** Upsell combo rules — Admin configures them; everyone can see them offered in booking. */
export function canManageUpsellRules(role: string): boolean {
  return role === "ADMIN";
}

/** Advances/fines/rewards against a staff member's pay — Admin only, since
 * the Operations Manager has no salary visibility (see canViewSalary). */
export function canManageStaffFinancials(role: string): boolean {
  return role === "ADMIN";
}

/** Full attendance list + admin-side corrections (Worker only sees/marks their own). */
export function canManageAttendance(role: string): boolean {
  return role === "ADMIN" || role === "OPERATIONS";
}

/** WhatsApp send log + resend controls. */
export function canViewWhatsAppLog(role: string): boolean {
  return role === "ADMIN";
}
