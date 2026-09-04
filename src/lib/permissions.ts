// Phase 2 — Production Foundation: fine-grained permission rules layered on
// top of the section-level ROLE_NAV_ACCESS matrix in constants.ts.
//
// Roles: ADMIN (Altaf) · OPERATIONS = Operations Manager (Francis) ·
// ACCOUNTS = Office Accountant (Shoyab) · SUPERVISOR = Team Leader ·
// STAFF = Worker.

export type Role = "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";

/** Admin sees and edits everything, including staff salary. */
export function canViewSalary(role: string): boolean {
  return role === "ADMIN";
}

/** Financial reports, profit dashboard, revenue figures. */
export function canViewFinancials(role: string): boolean {
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
  return role === "ADMIN" || role === "OPERATIONS";
}

/**
 * How far a role's job list reaches:
 * - ALL: every job (Admin)
 * - TODAY_TOMORROW: only jobs scheduled today or tomorrow (Operations Manager)
 * - OWN_TEAM: only jobs the user supervises or is assigned to (Team Leader)
 * - OWN_TODAY: only the user's own jobs scheduled today (Worker)
 */
export type JobScope = "ALL" | "TODAY_TOMORROW" | "OWN_TEAM" | "OWN_TODAY";

export function jobScopeFor(role: string): JobScope {
  if (role === "OPERATIONS") return "TODAY_TOMORROW";
  if (role === "SUPERVISOR") return "OWN_TEAM";
  if (role === "STAFF") return "OWN_TODAY";
  return "ALL";
}
