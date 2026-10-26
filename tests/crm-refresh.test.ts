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
import { canAccess, JOB_STATUSES } from "../src/lib/constants";
import { JOB_DISPLAY_LABELS, JOB_DISPLAY_STATUSES, cleanCustomerName, jobDisplayLabel, jobDisplayStatus, jobMatchesStatusFilter, storedStatusesFor } from "../src/lib/job-display";

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

test("Operations shows exactly 5 entries (owner 2026-10-23: Jobs, Team Dispatch & Slots, AMC Contracts + the team and specialised-service folds), in the agreed order", () => {
  const want = ["/jobs", "Team Dispatch & Slots", "/amc", "Team & Attendance", "Specialized Services"];
  assert.deepEqual(entries(NAV_ITEMS.filter((i) => i.group === "operations")), want);
  for (const role of ["ADMIN", "ACCOUNTS", "OPERATIONS"]) {
    const ops = entries(NAV_ITEMS.filter((i) => i.group === "operations" && canAccess(role, i.section)));
    assert.ok(ops.length <= 5, `${role}: ${ops.length} entries`);
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

test("the four sidebar sections hold exactly what the owner listed (2026-10-23); the old Tools & AI section is gone, its tools live in Settings & Admin / Finance", () => {
  const labels = (g: string) => NAV_ITEMS.filter((i) => i.group === g && !i.cluster).map((i) => i.label);
  assert.deepEqual(labels("sales"), ["Leads / CRM", "Parties"]); // owner 2026-10-24: Quick Quote Generator left the menu (the page still works)
  assert.deepEqual(labels("operations"), ["Jobs", "AMC Contracts"]);
  for (const gone of ["Quick Quote Generator", "Payment Link Sender", "Khata Book Import"]) assert.ok(!NAV_ITEMS.some((i) => i.label === gone), `${gone} left the menu (owner 2026-10-24)`);
  assert.ok(["User Management", "Message Log", "Lifecycle Reminders", "Settings"].every((l) => labels("admin").includes(l)));
    assert.equal(NAV_ITEMS.some((i) => i.href === "/admin/gallery"), false);
  assert.ok(!NAV_GROUPS.some((g) => (g.key as string) === "tools"));
  for (const href of ["/assistant", "/admin/whatsapp-inbox", "/admin/announcements"]) assert.ok(NAV_ITEMS.some((i) => i.href === href), `${href} is still in the menu`);
});

test("Payment Link Sender (no longer in the menu) is still a money page: Admin and Accounts only", () => {
  assert.equal(canAccess("ADMIN", "payments"), true);
  assert.equal(canAccess("ACCOUNTS", "payments"), true);
  assert.equal(canAccess("OPERATIONS", "payments"), false);
  assert.match(readFileSync("src/app/(app)/payments/send-link/page.tsx", "utf8"), /requireRole\(\["ADMIN", "ACCOUNTS"\]\)/);
});

// ---- jobs: six display statuses, filters, names --------------------------------------------------------------------------
test("every stored job status maps to one of exactly six display labels; ASSIGNED reads 'Confirmed'", () => {
  assert.equal(JOB_DISPLAY_STATUSES.length, 6);
  assert.deepEqual(Object.values(JOB_DISPLAY_LABELS), ["Confirmed", "Work Started", "Completed", "Postponed / Rescheduled", "Cancelled", "Pending Work"]);
  for (const s of JOB_STATUSES) assert.ok(jobDisplayStatus(s), `${s} has a display status`);
  assert.equal(jobDisplayLabel("ASSIGNED"), "Confirmed");
  assert.equal(jobDisplayLabel("REACTIVATED"), "Confirmed");
  assert.equal(jobDisplayLabel("ON_THE_WAY"), "Work Started");
  assert.equal(jobDisplayLabel("STARTED"), "Work Started");
  assert.equal(jobDisplayLabel("PENDING"), "Pending Work");
  assert.equal(jobDisplayLabel("POSTPONED"), "Postponed / Rescheduled");
  assert.equal(jobDisplayLabel("SOMETHING_NEW"), "SOMETHING_NEW", "unknown values are shown as stored, never hidden");
  const covered = JOB_DISPLAY_STATUSES.flatMap((d) => storedStatusesFor(d)).sort();
  assert.deepEqual(covered, [...JOB_STATUSES].sort(), "the six groups cover every stored status exactly once");
});

test("list filter accepts the new display keys and old stored-status links", () => {
  assert.equal(jobMatchesStatusFilter("ASSIGNED", "CONFIRMED"), true);
  assert.equal(jobMatchesStatusFilter("ON_THE_WAY", "WORK_STARTED"), true);
  assert.equal(jobMatchesStatusFilter("COMPLETED", "WORK_STARTED"), false);
  assert.equal(jobMatchesStatusFilter("PENDING", "PENDING"), true, "old /jobs?status=PENDING links still work");
  assert.equal(jobMatchesStatusFilter("ASSIGNED", "PENDING"), false);
  assert.equal(jobMatchesStatusFilter("CANCELLED", "ALL"), true);
  assert.equal(jobMatchesStatusFilter("CANCELLED", ""), true);
});

test("a leftover 'Cus ' prefix is stripped for display only; real names are untouched", () => {
  assert.equal(cleanCustomerName("Cus Prajakta Patil"), "Prajakta Patil");
  assert.equal(cleanCustomerName("CUS Prajakta Patil"), "Prajakta Patil");
  assert.equal(cleanCustomerName("Cus. Rahul"), "Rahul");
  assert.equal(cleanCustomerName("cus-Anil More"), "Anil More");
  assert.equal(cleanCustomerName("  Cus   Seema "), "Seema");
  assert.equal(cleanCustomerName("Cushman Wakefield"), "Cushman Wakefield");
  assert.equal(cleanCustomerName("Customer Care"), "Customer Care");
  assert.equal(cleanCustomerName("Cus"), "Cus", "never returns an empty name");
  assert.equal(cleanCustomerName(null), "");
});

test("jobs list: Load More on phones, page numbers from tablets up; compact money on the mobile card", () => {
  const src = readFileSync("src/components/jobs/jobs-explorer.tsx", "utf8");
  assert.match(src, /Load more jobs/);
  assert.match(src, /<div className="hidden sm:block">\s*<Pagination/);
  assert.match(src, /formatCompactINR\(total\)/);
  assert.match(src, /mobileItems\.map/);
});
