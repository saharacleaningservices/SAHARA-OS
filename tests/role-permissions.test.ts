// Role-permission matrix (CLAUDE.md "Roles and permissions" + owner rules 2026-09-25 / 2026-10-08).
// Pure functions only — no DB, no network. Run: npm run test:roles
// If an owner rule changes, update the rule in src/lib/permissions.ts / constants.ts AND this table together.
import test from "node:test";
import assert from "node:assert/strict";
import { canAccess } from "../src/lib/constants";
import * as p from "../src/lib/permissions";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROLES = ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"] as const;
type R = (typeof ROLES)[number];
// Owner-only CRM sections (Super Admin): Profit, User Management, Audit Log, security/device approvals, pricing, Khata import.
const OWNER_ONLY = ["profit", "users", "audit-log", "security-approvals", "device-approvals", "pricing", "khata-import"];
const only = (...allowed: R[]) => Object.fromEntries(ROLES.map((r) => [r, allowed.includes(r)])) as Record<R, boolean>;

function check(name: string, fn: (role: string) => boolean, expected: Record<R, boolean>) {
  for (const r of ROLES) assert.equal(fn(r), expected[r], `${name}(${r}) should be ${expected[r]}`);
}

test("owner-only powers: profit/financials, security, settings, data safety, WhatsApp log, upsell rules", () => {
  check("canViewFinancials", p.canViewFinancials, only("ADMIN"));
  check("canManageSecurity", p.canManageSecurity, only("ADMIN"));
  check("canManageSettings", p.canManageSettings, only("ADMIN"));
  check("canManageDataSafety", p.canManageDataSafety, only("ADMIN"));
  check("canViewWhatsAppLog", p.canViewWhatsAppLog, only("ADMIN"));
  check("canManageUpsellRules", p.canManageUpsellRules, only("ADMIN"));
  for (const r of ROLES) assert.equal(canAccess(r, "profit"), r === "ADMIN", `profit nav for ${r}`);
});

test("money: revenue + salary only Admin/Accounts; Operations sees per-job amount only (owner rule 2026-10-08)", () => {
  check("canViewRevenue", p.canViewRevenue, only("ADMIN", "ACCOUNTS"));
  check("canViewSalary", p.canViewSalary, only("ADMIN", "ACCOUNTS"));
  check("canManageStaffFinancials", p.canManageStaffFinancials, only("ADMIN", "ACCOUNTS"));
  check("canViewJobAmount", p.canViewJobAmount, only("ADMIN", "ACCOUNTS", "OPERATIONS"));
  for (const section of ["revenue", "payments", "expenses", "reports", "invoices", "quotations"]) {
    for (const r of ["OPERATIONS", "SUPERVISOR", "STAFF"] as const) assert.equal(canAccess(r, section), false, `${r} must not reach ${section}`);
  }
});

test("customer contact (phone/WhatsApp/email): Admin + Accounts only — never Operations, Supervisor or Staff", () => {
  check("canSeeCustomerContact", p.canSeeCustomerContact, only("ADMIN", "ACCOUNTS"));
  check("canSearchGlobally", p.canSearchGlobally, only("ADMIN", "ACCOUNTS"));
  check("canExportCustomers", p.canExportCustomers, only("ADMIN")); // owner rule 2026-10-31
  check("canDeleteRecords", p.canDeleteRecords, only("ADMIN"));
  for (const r of ["OPERATIONS", "SUPERVISOR", "STAFF"] as const) assert.equal(canAccess(r, "customers"), false, `${r} must not reach customers`);
});

test("Field Staff: Staff App only — no CRM section at all", () => {
  for (const section of ["dashboard", "leads", "jobs", "customers", "staff", "attendance", "payments", "pricing", "admin"]) {
    assert.equal(canAccess("STAFF", section), false, `STAFF must not reach ${section}`);
  }
  assert.equal(canAccess("STAFF", "my"), true);
  assert.equal(p.jobScopeFor("STAFF"), "OWN_TODAY");
});

test("Operations (Francis): field command centre — jobs/staff/vehicles/attendance/AMC, scoped to yesterday→tomorrow", () => {
  for (const section of ["dashboard", "leads", "jobs", "staff", "vehicles", "attendance", "amc"]) assert.equal(canAccess("OPERATIONS", section), true, section);
  for (const section of ["assistant", "whatsapp-log", "pricing", "users", "audit-log", "customers"]) assert.equal(canAccess("OPERATIONS", section), false, section);
  assert.equal(p.jobScopeFor("OPERATIONS"), "YESTERDAY_TODAY_TOMORROW");
  assert.equal(p.canDeleteRecords("OPERATIONS"), false);
});

test("Accounts (Shoyab): full working CRM but no owner-only areas", () => {
  for (const section of ["payments", "quotations", "invoices", "customers", "expenses", "staff", "attendance", "vehicles", "leads", "jobs"]) assert.equal(canAccess("ACCOUNTS", section), true, section);
  // owner rule 2026-10-31: no P&L / revenue dashboards or Export Center for Shoyab
  for (const section of ["revenue", "reports", "settings"]) assert.equal(canAccess("ACCOUNTS", section), false, section);
  assert.equal(p.canManageSecurity("ACCOUNTS"), false);
  assert.equal(p.canEditBilling("OPERATIONS"), false);
  for (const section of OWNER_ONLY) assert.equal(canAccess("ACCOUNTS", section), false, section);
  assert.equal(p.jobScopeFor("ACCOUNTS"), "ALL");
});

test("unknown or empty role gets nothing", () => {
  for (const fn of [p.canViewRevenue, p.canSeeCustomerContact, p.canViewJobAmount, p.canViewFinancials, p.canSearchGlobally]) {
    assert.equal(fn(""), false);
    assert.equal(fn("HACKER"), false);
  }
  assert.equal(canAccess("", "dashboard"), false);
  assert.equal(canAccess("HACKER", "dashboard"), false);
});

test("Super Admin only: every owner-only section is closed to Accounts, Operations, Supervisor and Staff", () => {
  for (const section of OWNER_ONLY) {
    assert.equal(canAccess("ADMIN", section), true, `ADMIN ${section}`);
    for (const r of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"] as const) assert.equal(canAccess(r, section), false, `${r} must not reach ${section}`);
  }
});

test("guard: every section named in this file is a real nav section (a typo must not pass silently)", () => {
  const nav = readFileSync(path.join(process.cwd(), "src/components/layout/nav-config.tsx"), "utf8");
  // "admin" is still a real section (the /admin/gallery page and ROLE_NAV_ACCESS use it) although Gallery left the menu (2026-10-22).
  const real = new Set([...nav.matchAll(/section: "([a-z-]+)"/g)].map((m) => m[1]).concat(["my", "admin", "khata-import"])); // khata-import: the page stays Super-Admin-only although it left the menu (2026-10-24)
  const src = readFileSync(path.join(process.cwd(), "tests/role-permissions.test.ts"), "utf8");
  const named = new Set([...src.matchAll(/canAccess\("[A-Z]+", "([a-z-]+)"\)/g)].map((m) => m[1]));
  for (const list of src.matchAll(/(?:for \(const section of |OWNER_ONLY = )\[([^\]]+)\]/g)) for (const s of list[1].matchAll(/"([a-z-]+)"/g)) named.add(s[1]);
  const unknown = [...named].filter((s) => !real.has(s));
  assert.deepEqual(unknown, [], `unknown section keys: ${unknown.join(", ")}`);
});
