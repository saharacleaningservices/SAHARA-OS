// Sidebar accordion: every destination sits in exactly one of the 7 groups, and each role only gets what ROLE_NAV_ACCESS allows.
// Run: npm run test:nav
import test from "node:test";
import assert from "node:assert/strict";
import { NAV_GROUPS, NAV_ITEMS } from "../src/components/layout/nav-config";
import { canAccess } from "../src/lib/constants";

const itemsFor = (role: string) => NAV_ITEMS.filter((i) => canAccess(role, i.section));
const groupsFor = (role: string) =>
  NAV_GROUPS.map((g) => ({ key: g.key, label: g.label, items: itemsFor(role).filter((i) => i.group === g.key) })).filter((g) => g.items.length > 0);

test("seven groups in MyBillBook order (owner 2026-10-23)", () => {
  assert.deepEqual(NAV_GROUPS.map((g) => g.label), ["Dashboards & Reports", "Parties", "Sales", "Purchases", "Operations", "Tools & AI", "Settings & Admin"]);
});

test("every nav item belongs to exactly one known group (nothing lost, nothing duplicated)", () => {
  const known = new Set(NAV_GROUPS.map((g) => g.key));
  for (const i of NAV_ITEMS) assert.ok(known.has(i.group), `${i.label} has an unknown group`);
  const total = NAV_GROUPS.reduce((n, g) => n + NAV_ITEMS.filter((i) => i.group === g.key).length, 0);
  assert.equal(total, NAV_ITEMS.length);
  assert.equal(new Set(NAV_ITEMS.map((i) => i.href)).size, NAV_ITEMS.length, "hrefs are unique");
});

test("ADMIN sees everything, spread over all seven groups", () => {
  assert.equal(itemsFor("ADMIN").length, NAV_ITEMS.length);
  assert.equal(groupsFor("ADMIN").length, 7);
});

test("OPERATIONS (Francis): field-only — no money, profit, user or audit pages in any group", () => {
  const hrefs = itemsFor("OPERATIONS").map((i) => i.href);
  for (const banned of ["/payments", "/expenses", "/profit", "/profit/marketing", "/revenue", "/reports", "/customers", "/quotations", "/invoices", "/admin/users", "/admin/audit-log", "/settings/pricing", "/assistant"]) {
    assert.ok(!hrefs.includes(banned), `OPERATIONS must not get ${banned}`);
  }
  assert.ok(hrefs.includes("/dashboard") && hrefs.includes("/jobs") && hrefs.includes("/attendance") && hrefs.includes("/leads"));
  for (const g of groupsFor("OPERATIONS")) assert.ok(g.items.length > 0, "empty groups are hidden");
});

test("ACCOUNTS (Shoyab): finance and reports yes; profit, user management, audit log, device/security approvals no", () => {
  const hrefs = itemsFor("ACCOUNTS").map((i) => i.href);
  for (const ok of ["/payments", "/expenses", "/quotations", "/invoices", "/revenue", "/reports", "/customers"]) assert.ok(hrefs.includes(ok), `ACCOUNTS should get ${ok}`);
  for (const banned of ["/profit", "/profit/marketing", "/admin/users", "/admin/audit-log", "/admin/device-approvals", "/admin/security-approvals"]) {
    assert.ok(!hrefs.includes(banned), `ACCOUNTS must not get ${banned}`);
  }
});

test("the Dashboard link is always reachable (Dashboards & Reports group) for every office role", () => {
  for (const role of ["ADMIN", "OPERATIONS", "ACCOUNTS"]) {
    const g = groupsFor(role).find((x) => x.items.some((i) => i.href === "/dashboard"));
    assert.equal(g?.key, "dashboards", role);
  }
});
