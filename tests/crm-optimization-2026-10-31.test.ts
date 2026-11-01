import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { last10, validMobile10 } from "../src/lib/phone";
import { safeEqual } from "../src/lib/safe-equal";
import { isLeadResponseOverdue, LEAD_RESPONSE_SLA_MS, formatWait } from "../src/lib/lead-response";
import { buildQuickTemplate, QUICK_TEMPLATES } from "../src/lib/whatsapp-quick-templates";
import { KIND_TO_NAV_HREF } from "../src/lib/nav-badge-map";
import * as p from "../src/lib/permissions";
import { canAccess } from "../src/lib/constants";
import { operationsLeadWhere, operationsLeadWindow, canAccessLead } from "../src/server/leads";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("phone: one normaliser — +91 / 0 / spaces all collapse to the same last 10 digits", () => {
  for (const v of ["+91 98765 43210", "09876543210", "919876543210", "98765-43210", "9876543210"]) assert.equal(last10(v), "9876543210", v);
  assert.equal(last10(null), "");
  assert.equal(validMobile10("12345"), null);
  assert.equal(validMobile10("5876543210"), null); // must start 6-9
  assert.equal(validMobile10("+919876543210"), "9876543210");
});

test("safeEqual: constant-time compare semantics", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("no module re-declares the shared helpers (waLink, last10, safeEqual, requireAdmin)", () => {
  const files = [
    "src/app/api/webhook/cognito/route.ts", "src/app/api/webhook/email-lead/route.ts", "src/lib/public-api-auth.ts", "src/lib/call-webhook-auth.ts",
    "src/components/public/landing-kit.tsx", "src/components/public/campaign-kit.tsx", "src/components/public/ppc-landing.tsx", "src/components/public/category-landing.tsx",
    "src/server/actions/integrations.ts", "src/server/actions/khata-import.ts", "src/server/actions/whatsapp-campaigns.ts", "src/server/actions/whatsapp-queue.ts", "src/server/actions/users.ts",
    "src/server/staff-registration.ts", "src/server/public-booking-core.ts",
  ];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /function safeEqual\(|const waLink =|function last10\(|const last10 = \(|async function requireAdmin\(|async function requireAdminSession\(/, `${f} still declares a duplicated helper`);
  }
});

test("/book is a pure redirect to /booking; the standalone form is gone and ?bl= links go to the wizard", () => {
  assert.equal(existsSync(path.join(root, "src/components/public/public-booking-form.tsx")), false);
  const book = read("src/app/book/page.tsx");
  assert.match(book, /redirect\(`\/booking/);
  assert.doesNotMatch(book, /import .*(PublicBookingForm|BookingWizard)/);
  assert.match(read("src/server/actions/booking-links.ts"), /\/booking\?/);
  assert.match(read("src/components/public/booking-wizard.tsx"), /bookingLinkToken/);
});

test("Francis lead window: strictly yesterday → tomorrow (service, follow-up or created date)", () => {
  const now = new Date();
  const { from, to } = operationsLeadWindow(now);
  const day = 86400000;
  assert.ok(from.getTime() <= now.getTime() - day + day && from.getTime() > now.getTime() - 2 * day, "starts at start of yesterday");
  assert.ok(to.getTime() >= now.getTime() + day && to.getTime() < now.getTime() + 2 * day, "ends at end of tomorrow");
  const w = operationsLeadWhere("u1");
  assert.equal(w.OR.length, 3);
  const mk = (offsetDays: number) => new Date(now.getTime() + offsetDays * day);
  const session = { sub: "u1", role: "OPERATIONS" } as never;
  const lead = (o: Partial<{ followUpDate: Date | null; serviceDate: Date | null; createdAt: Date; stage: string }>) => ({ followUpDate: null, serviceDate: null, createdAt: mk(-10), stage: "NEW", assignedToId: "u1", createdById: "u1", ...o });
  assert.equal(canAccessLead(session, lead({ createdAt: mk(0) })), true);
  assert.equal(canAccessLead(session, lead({ serviceDate: mk(1) })), true);
  assert.equal(canAccessLead(session, lead({ followUpDate: mk(-1) })), true);
  assert.equal(canAccessLead(session, lead({ createdAt: mk(-5), stage: "NEW" })), false, "old NEW lead assigned to him is out of window");
  assert.equal(canAccessLead(session, lead({ serviceDate: mk(5) })), false);
});

test("RBAC 2026-10-31: Shoyab (ACCOUNTS) and Francis (OPERATIONS)", () => {
  // Shoyab: full ops + expenses + vehicles + staff, but no P&L, no admin security, no export / delete.
  for (const s of ["leads", "jobs", "customers", "staff", "attendance", "vehicles", "expenses"]) assert.equal(canAccess("ACCOUNTS", s), true, s);
  for (const s of ["revenue", "reports", "profit", "settings", "users", "audit-log"]) assert.equal(canAccess("ACCOUNTS", s), false, s);
  assert.equal(p.canExportCustomers("ACCOUNTS"), false);
  assert.equal(p.canDeleteRecords("ACCOUNTS"), false);
  assert.equal(p.canManageSecurity("ACCOUNTS"), false);
  assert.equal(p.canViewFinancials("ACCOUNTS"), false);
  // Francis: masked numbers, no revenue/salary/billing edit/settings.
  assert.equal(p.canSeeCustomerContact("OPERATIONS"), false);
  assert.equal(p.canViewSalary("OPERATIONS"), false);
  assert.equal(p.canViewRevenue("OPERATIONS"), false);
  assert.equal(p.canEditBilling("OPERATIONS"), false);
  assert.equal(p.canManageSettings("OPERATIONS"), false);
  assert.equal(p.jobScopeFor("OPERATIONS"), "YESTERDAY_TODAY_TOMORROW");
  // Super Admin keeps everything.
  for (const f of [p.canExportCustomers, p.canDeleteRecords, p.canEditBilling, p.canManageSecurity]) assert.equal(f("ADMIN"), true);
});

test("lead response timer: red only for NEW leads past 15 minutes", () => {
  const now = Date.now();
  const at = (minAgo: number) => new Date(now - minAgo * 60000);
  assert.equal(LEAD_RESPONSE_SLA_MS, 15 * 60 * 1000);
  assert.equal(isLeadResponseOverdue("NEW", at(14), now), false);
  assert.equal(isLeadResponseOverdue("NEW", at(15), now), true);
  assert.equal(isLeadResponseOverdue("INTERESTED", at(60), now), false);
  assert.equal(formatWait(5 * 60000), "5 min");
  assert.equal(formatWait(125 * 60000), "2h 5m");
});

test("WhatsApp quick templates: four templates, name and amount filled, no raw placeholders", () => {
  assert.deepEqual(QUICK_TEMPLATES.map((t) => t.key), ["QUOTE_FOLLOWUP", "PAYMENT_REMINDER", "ON_THE_WAY", "REVIEW_REQUEST"]);
  const ctx = { name: "Priya Sharma", service: "Home Deep Cleaning", amount: 4999 };
  for (const t of QUICK_TEMPLATES) {
    const m = buildQuickTemplate(t.key, ctx);
    assert.match(m, /Hi Priya/, t.key);
    assert.doesNotMatch(m, /\{|undefined|null/, t.key);
  }
  assert.match(buildQuickTemplate("PAYMENT_REMINDER", ctx), /₹4,999/);
  assert.match(buildQuickTemplate("REVIEW_REQUEST", ctx), /https:\/\/g\.page\//);
});

test("sidebar badges ride the existing bell poll (no new timers or endpoints)", () => {
  assert.equal(KIND_TO_NAV_HREF.NEW_INQUIRY, "/leads");
  assert.equal(KIND_TO_NAV_HREF.LEAD_UNCONTACTED, "/leads");
  assert.match(read("src/app/api/notifications/feed/route.ts"), /groupBy/);
  assert.doesNotMatch(read("src/lib/nav-badges.ts"), /setInterval|fetch\(/);
  assert.doesNotMatch(read("src/server/lead-response.ts"), /setInterval|setTimeout/);
});

test("mobile primitives: 16px / 44px on phones, compact from sm up", () => {
  assert.match(read("src/components/ui/input.tsx"), /h-11[^"]*text-base[^"]*sm:h-9[^"]*sm:text-sm/);
  assert.match(read("src/components/ui/textarea.tsx"), /text-base[^"]*sm:text-sm/);
  assert.match(read("src/components/ui/select.tsx"), /text-base[^"]*sm:text-sm/);
  assert.match(read("src/components/ui/select.tsx"), /data-\[size=default\]:h-11/);
  assert.match(read("src/components/ui/button.tsx"), /default: "h-11/);
});

test("theme toggle exists in the topbar menu and uses the existing .dark palette", () => {
  assert.match(read("src/components/layout/topbar.tsx"), /ThemeToggleItem/);
  assert.match(read("src/app/globals.css"), /\.dark \{/);
});
