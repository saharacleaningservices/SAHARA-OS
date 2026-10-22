// CRM refresh (2026-10-22): role dashboards, menus, formatting and job display helpers. Run: npm run test:crmrefresh
// Pure functions + source-level guards (no database).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dashboardViewFor } from "../src/components/dashboard/role-view-toggle";
import { conversionRate } from "../src/server/dashboard-extras";
import { funnelWidths, stepRates } from "../src/components/marketing/conversion-funnel";
import { formatCompactINR } from "../src/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "../src/components/layout/nav-config";
import { canAccess } from "../src/lib/constants";

// ---- role dashboards -------------------------------------------------------------------------------------------------
test("'view as' is an ADMIN-only preview; every other role always gets its own dashboard", () => {
  assert.equal(dashboardViewFor("ADMIN", "operations"), "operations");
  assert.equal(dashboardViewFor("ADMIN", "finance"), "finance");
  assert.equal(dashboardViewFor("ADMIN", undefined), "all");
  assert.equal(dashboardViewFor("ADMIN", "profit"), "all", "unknown values fall back to the full view");
  for (const role of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF", ""]) {
    assert.equal(dashboardViewFor(role, "finance"), "all", `${role} cannot switch views`);
    assert.equal(dashboardViewFor(role, "operations"), "all", `${role} cannot switch views`);
  }
});

test("Francis's operations dashboard never touches money helpers", () => {
  const src = readFileSync("src/components/dashboard/owner/operations-command-center.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ""); // code only, not comments
  for (const banned of ["getOwnerSnapshot", "getInvoiceStatusSummary", "formatINR", "formatCompactINR", "netProfit", "revenue", "expenses"]) {
    assert.ok(!src.includes(banned), `operations-command-center must not reference ${banned}`);
  }
});

test("the dashboard page only builds the owner sections with profit for a real, un-previewed ADMIN", () => {
  const src = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
  assert.match(src, /showProfit: asRole === "ADMIN"/);
  assert.match(src, /const asRole = view === "finance" \? "ACCOUNTS" : session\.role;/);
  assert.match(src, /session\.role === "OPERATIONS" \|\| view === "operations"/);
});

test("Shoyab's finance view drops the team-assignment chips; overdue list only when something is overdue", () => {
  const src = readFileSync("src/components/dashboard/owner/owner-command-center.tsx", "utf8");
  assert.match(src, /if \(role !== "ACCOUNTS"\) \{\s*\n\s*chips\.push\(\{ href: "\/jobs\?when=today", label: "jobs without staff"/);
  assert.match(src, /alerts\.overduePayments\.length > 0 && \(/);
  const finance = src.slice(src.indexOf("const finance = ("));
  assert.ok(finance.indexOf("Cash Flow") < finance.indexOf("Overdue Payments"), "Cash Flow is the first card of the Finance tab");
});

test("lead-to-booking conversion rate", () => {
  assert.equal(conversionRate(0, 0), 0);
  assert.equal(conversionRate(3, 10), 30);
  assert.equal(conversionRate(2, 3), 67);
});

test("marketing funnel widths and step conversions", () => {
  const stages = [{ label: "Leads", value: 200 }, { label: "Interested", value: 100 }, { label: "Quotation", value: 1 }, { label: "Booked", value: 0 }, { label: "Completed", value: 0 }];
  assert.deepEqual(funnelWidths(stages), [100, 50, 4, 0, 0], "tiny non-zero stages stay visible; empty stages have no bar");
  assert.deepEqual(stepRates(stages), ["", "50%", "1%", "0%", "—"]);
  assert.deepEqual(funnelWidths([{ label: "Leads", value: 0 }]), [0]);
});

// ---- formatting --------------------------------------------------------------------------------------------------------
test("compact rupees for mobile cards (Indian units)", () => {
  assert.equal(formatCompactINR(681234), "₹6.81L");
  assert.equal(formatCompactINR(100000), "₹1L");
  assert.equal(formatCompactINR(150000), "₹1.5L");
  assert.equal(formatCompactINR(12500000), "₹1.25Cr");
  assert.equal(formatCompactINR(-250000), "-₹2.5L");
  assert.equal(formatCompactINR(99999), "₹99,999");
  assert.equal(formatCompactINR(0), "₹0");
  assert.equal(formatCompactINR(null), "₹0");
  assert.equal(formatCompactINR(Number.NaN), "₹0");
});

// ---- menus ---------------------------------------------------------------------------------------------------------------
const entries = (items: typeof NAV_ITEMS) => {
  const seen: string[] = [];
  for (const i of items) {
    const key = i.cluster ?? i.href;
    if (!seen.includes(key)) seen.push(key);
  }
  return seen;
};

test("Operations shows exactly 6 entries for every office role, in the agreed order", () => {
  const want = ["/jobs", "/jobs/quick-quote", "Team Dispatch & Slots", "Team & Attendance", "/amc", "Specialized Services"];
  assert.deepEqual(entries(NAV_ITEMS.filter((i) => i.group === "operations")), want);
  for (const role of ["ADMIN", "ACCOUNTS", "OPERATIONS"]) {
    const ops = entries(NAV_ITEMS.filter((i) => i.group === "operations" && canAccess(role, i.section)));
    assert.ok(ops.length <= 6, `${role}: ${ops.length} entries`);
  }
});

test("clusters are contiguous, and every old Operations page is still in the menu", () => {
  const ops = NAV_ITEMS.filter((i) => i.group === "operations");
  const clusters = ops.map((i) => i.cluster).filter(Boolean) as string[];
  for (const c of new Set(clusters)) {
    const idx = ops.map((i, n) => (i.cluster === c ? n : -1)).filter((n) => n >= 0);
    assert.equal(idx[idx.length - 1] - idx[0] + 1, idx.length, `${c} items are next to each other`);
  }
  for (const href of ["/jobs/dispatch", "/jobs/slots", "/staff", "/vehicles", "/attendance", "/jobs?service=HOUSEKEEPING", "/jobs?service=PEST_CONTROL", "/jobs?service=INTERIOR_PAINTING"]) {
    assert.ok(ops.some((i) => i.href === href), `${href} still reachable from the menu`);
  }
});

test("Tools & AI keeps only AI Assistant, WhatsApp Inbox, Payment Link Sender, Announcements; Khata moved to Settings & Admin; Gallery out of the menu", () => {
  assert.deepEqual(NAV_ITEMS.filter((i) => i.group === "tools").map((i) => i.label), ["AI Assistant", "WhatsApp Inbox", "Payment Link Sender", "Announcements"]);
  assert.equal(NAV_ITEMS.find((i) => i.href === "/admin/khata-import")?.group, "admin");
  assert.equal(NAV_ITEMS.some((i) => i.href === "/admin/gallery"), false);
  assert.ok(NAV_GROUPS.some((g) => g.key === "tools"));
});

test("Payment Link Sender is a money page: Admin and Accounts only", () => {
  const item = NAV_ITEMS.find((i) => i.href === "/payments/send-link")!;
  assert.equal(canAccess("ADMIN", item.section), true);
  assert.equal(canAccess("ACCOUNTS", item.section), true);
  assert.equal(canAccess("OPERATIONS", item.section), false);
  assert.match(readFileSync("src/app/(app)/payments/send-link/page.tsx", "utf8"), /requireRole\(\["ADMIN", "ACCOUNTS"\]\)/);
});
