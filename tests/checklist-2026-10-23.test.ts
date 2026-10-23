// Owner checklist 2026-10-23: sidebar cleanup, staff privacy, job completed → invoice workflow, single-page A4 PDF.
// Run: npm run test:checklist — throwaway SQLite DB; no network; WhatsApp stays in TEST mode (no credentials).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NAV_ITEMS } from "../src/components/layout/nav-config";
import { PRICE_TABS, WHATSAPP_TABS } from "../src/components/shared/section-tabs";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-checklist-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET = "test-secret-for-crew-card-tokens-0123456789";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_OUTBOUND_MODE", "WHATSAPP_DOC_LINKS"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let billing: typeof import("../src/server/actions/job-billing");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  billing = await import("../src/server/actions/job-billing");
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// 1. Sidebar cleanup ------------------------------------------------------------------------------------------------------
test("sidebar: no duplicate entries; Price List + Service Catalog grouped (and tabbed); Message Log and Inbox linked by tabs", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "no duplicate destinations");
  assert.equal(new Set(NAV_ITEMS.map((i) => i.label)).size, NAV_ITEMS.length, "no duplicate labels");
  const prices = NAV_ITEMS.filter((i) => i.cluster === "Prices & Service Catalog").map((i) => i.href);
  assert.deepEqual(prices, ["/leads/price-list", "/service-catalog"], "Price List + Service Catalog grouped under one entry");
  for (const h of ["/jobs", "/invoices", "/customers", "/admin/whatsapp-log", "/leads/price-list"]) assert.ok(hrefs.includes(h), `${h} stays one click away`);
  assert.deepEqual(PRICE_TABS.map((t) => t.href), ["/leads/price-list", "/service-catalog"]);
  assert.deepEqual(WHATSAPP_TABS.map((t) => t.href), ["/admin/whatsapp-log", "/admin/whatsapp-inbox"]);
});

// 2. Staff privacy ---------------------------------------------------------------------------------------------------------
test("Staff App pages and the crew card never read the customer phone or a job amount", () => {
  const files = [...walk("src/app/my"), "src/server/staff-portal.ts", "src/server/crew-card.ts", "src/app/crew-card/[token]/page.tsx"].filter((f) => /\.tsx?$/.test(f));
  for (const f of files) {
    const src = read(f);
    assert.ok(!/customerMobile|alternateMobile/.test(src), `${f}: no customer phone`);
    assert.ok(!/jobValue|paidAmount|discountAmount|gstAmount|balanceDue/.test(src), `${f}: no job money`);
  }
});

// 4. Job completed → invoice workflow -------------------------------------------------------------------------------------
test("completion prompt offers Open Invoice, A4 PDF and Resend; the job page keeps Download + Resend side by side", () => {
  const sa = read("src/components/jobs/status-actions.tsx");
  assert.match(sa, /Final Invoice ready/);
  assert.match(sa, /setInvoicePrompt\(true\)/);
  assert.match(sa, /Invoice \(A4 PDF\)/);
  assert.match(sa, /ResendInvoiceLinkButton/);
  const page = read("src/app/(app)/jobs/[id]/page.tsx");
  // Owner 2026-10-23: ONE document button (the single-page A4 PDF); the old View / A4 PDF / PDF buttons are gone.
  assert.match(page, /invoicePdfHref = job\.invoice && completed \? `\/api\/invoices\/\$\{job\.invoice\.id\}\/pdf`/);
  assert.ok(!/> View<\/a>|> A4 PDF<\/a>|> PDF<\/a>/.test(page), "no redundant View / A4 PDF / PDF buttons");
  assert.match(page, /ResendInvoiceLinkButton jobId=\{job\.id\}/);
});

test("Resend Invoice Link: billing roles only, completed jobs only, sends again even after the first message", async () => {
  const job = await db.job.create({ data: { jobNumber: "C-1", customerName: "Asha", customerMobile: "9876500077", address: "Flat 2", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 5000, status: "STARTED" } as never });
  session = { sub: "u", name: "S", email: "s@t", role: "ADMIN" };
  assert.equal((await billing.resendInvoiceLink(job.id)).success, false, "not completed yet");
  await db.job.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
  for (const role of ["SUPERVISOR", "STAFF"]) {
    session = { sub: "u", name: role, email: "s@t", role };
    assert.equal((await billing.resendInvoiceLink(job.id)).success, false, role);
  }
  session = null;
  assert.equal((await billing.resendInvoiceLink(job.id)).success, false);
  session = { sub: "u", name: "Accounts", email: "s@t", role: "ACCOUNTS" };
  const a = await billing.resendInvoiceLink(job.id);
  const b = await billing.resendInvoiceLink(job.id);
  assert.ok(a.success && b.success);
  assert.match((a as { message: string }).message, /TEST mode/, "honest about TEST mode");
  const msgs = await db.whatsAppMessage.findMany({ where: { kind: "JOB_COMPLETED", relatedId: job.id } });
  assert.equal(msgs.length, 2, "resend is not blocked by the once-per-job guard");
  assert.ok(msgs.every((m) => m.body.includes("/booking/invoice/") && m.status !== "SENT"));
});

// 5. Single-page A4 PDF ----------------------------------------------------------------------------------------------------
test("quotation, invoice and crew card print as A4 with page-break avoidance; CRM PDF buttons open the print view", () => {
  const doc = read("src/components/public/customer-document.tsx");
  assert.match(doc, /@page\{size:A4;margin:7mm\}/);
  assert.match(doc, /page-break-inside:avoid/);
  // Owner 2026-10-23 (autonomous brief P2): scope, equipment and terms are accordions on screen and open by themselves when printed.
  assert.match(doc, /<DocAccordion title=\{`Scope of Work/);
  assert.match(read("src/components/public/doc-accordion.tsx"), /beforeprint/);
  assert.match(read("src/app/crew-card/[token]/page.tsx"), /@page\{size:A4/);
  assert.match(read("src/components/public/document-actions.tsx"), /get\("print"\) !== "1"/);
});

// 3. Existing jobs in the Staff App -----------------------------------------------------------------------------------------
test("existing jobs appear in the Staff App live, from the crew assignment — no copy to sync; upcoming days stay hidden (owner rule)", async () => {
  const portal = await import("../src/server/staff-portal");
  const staff = await db.staff.create({ data: { employeeCode: "T-CK1", name: "Ravi", mobile: "9000000444", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY" } as never });
  const me = { id: staff.id, name: "Ravi", employeeCode: "T-CK1", designation: "Cleaner", mobile: "9000000444", photoUrl: null } as never;
  const mk = (n: string, days: number) => db.job.create({ data: { jobNumber: n, customerName: "Asha", customerMobile: "9876500011", address: "Flat 2", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() + days * 86_400_000), scheduledTime: "10:00 AM", jobValue: 5137, status: "ASSIGNED" } as never });
  const todayJob = await mk("CK-TODAY", 0);
  const futureJob = await mk("CK-FUTURE", 3);
  assert.equal((await portal.getPortalHome(me)).todaysJobs.length, 0, "not assigned yet -> not shown");
  // Assigning the crew on an existing job is all it takes: the Staff App reads assignments directly, so it shows at once.
  await db.jobAssignment.create({ data: { jobId: todayJob.id, staffId: staff.id } as never });
  await db.jobAssignment.create({ data: { jobId: futureJob.id, staffId: staff.id } as never });
  const home = await portal.getPortalHome(me);
  assert.deepEqual(home.todaysJobs.map((j) => j.jobNumber), ["CK-TODAY"]);
  assert.ok(!home.upcomingJobs.some((j) => j.jobNumber === "CK-FUTURE"), "future assignments stay hidden (owner rule 2026-10-05)");
  const json = JSON.stringify(home);
  assert.ok(!json.includes("9876500011") && !json.includes("5137"), "no phone, no amount in the Staff App data"); // 5137 is a distinctive amount: "5000" could match a random id
});

// Jobs list order (owner 2026-10-23) ---------------------------------------------------------------------------------------
test("/jobs: upcoming work in calendar order (24, 25, 26 Oct… then November), then past jobs most recent first", async () => {
  const { orderJobsForList } = await import("../src/server/jobs");
  const d = (s: string) => new Date(`${s}T10:00:00+05:30`);
  const now = d("2026-10-23");
  const rows = [
    { jobNumber: "J-NOV", scheduledDate: d("2026-11-05") }, { jobNumber: "J-26", scheduledDate: d("2026-10-26") }, { jobNumber: "J-OLD", scheduledDate: d("2026-09-01") },
    { jobNumber: "J-24B", scheduledDate: d("2026-10-24") }, { jobNumber: "J-TODAY", scheduledDate: d("2026-10-23") }, { jobNumber: "J-24A", scheduledDate: d("2026-10-24") },
    { jobNumber: "J-YEST", scheduledDate: d("2026-10-22") }, { jobNumber: "J-25", scheduledDate: d("2026-10-25") },
  ];
  assert.deepEqual(orderJobsForList(rows, now).map((r) => r.jobNumber), ["J-TODAY", "J-24A", "J-24B", "J-25", "J-26", "J-NOV", "J-YEST", "J-OLD"]);
});
