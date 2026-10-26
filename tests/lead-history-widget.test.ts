// New Lead right-side customer history (autonomous brief P4.3): lifetime value, last service, notes — money and notes by role.
// Run: npx tsx --test tests/lead-history-widget.test.ts   Synthetic data; throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-lh-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
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
let act: typeof import("../src/server/actions/customer-actions");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/customer-actions");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("summary: lifetime value = CRM payments received + MyBillBook paid; last service first; notes for contact roles; Operations see no money and no notes", async () => {
  const c = await db.customer.create({ data: { name: "Asha Rao", mobile: "9811111111", customerNumber: "C-1", notes: "Prefers mornings. Dog at home." } });
  const job = await db.job.create({ data: { jobNumber: "H-1", customerName: "Asha Rao", customerMobile: c.mobile, address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() - 40 * 86400000), scheduledTime: "10:00 AM", jobValue: 5000, status: "COMPLETED" } as never });
  await db.payment.create({ data: { jobId: job.id, clientName: "Asha Rao", clientMobile: "9811111111", invoiceNumber: "P-1", amount: 5000, paidAmount: 5000, dueDate: new Date(), status: "PAID", paidDate: new Date() } as never });
  await db.mybillbookInvoice.create({ data: { invoiceNo: "M1", invoiceKey: "i/m1", invoiceDate: new Date(Date.now() - 400 * 86400000), contactName: "Asha", amount: 4000, remaining: 1000, status: "Unpaid", invoiceLink: "https://mybillbook.in/i/m1", serviceName: "Sofa Cleaning", customerId: c.id } });

  session = { sub: "a", name: "Altaf", email: "a@x", role: "ADMIN" };
  const a = (await act.getRepeatCustomerSummary("9811111111"))!;
  assert.equal(a.lifetimeValue, 8000); // 5000 CRM + (4000 - 1000) MyBillBook
  assert.equal(a.notes, "Prefers mornings. Dog at home.");
  assert.deepEqual(a.recentServices.map((r) => r.service), ["Home Deep Cleaning", "Sofa Cleaning"], "newest first");
  assert.equal(a.recentServices[0].paid, 5000);

  session = { sub: "o", name: "Francis", email: "f@x", role: "OPERATIONS" };
  const o = (await act.getRepeatCustomerSummary("9811111111"))!;
  assert.equal(o.lifetimeValue, null);
  assert.equal(o.notes, null);
  assert.ok(o.recentServices.every((r) => r.paid === null), "no amounts for Operations");

  session = { sub: "s", name: "Crew", email: "s@x", role: "STAFF" };
  assert.equal(await act.getRepeatCustomerSummary("9811111111"), null, "Field Staff get nothing");
  session = { sub: "a", name: "Altaf", email: "a@x", role: "ADMIN" };
  assert.equal(await act.getRepeatCustomerSummary("9000000000"), null, "unknown number: no widget");
});

test("the form shows the widget on the right (large screens) for a new lead, with Use Customer Data wired to the fill-in", () => {
  const form = readFileSync("src/components/leads/lead-form.tsx", "utf8");
  assert.match(form, /!leadId && repeatCustomer && \(\s*<aside[\s\S]*?<CustomerHistoryWidget customer=\{repeatCustomer\} canUse onUse=\{applyExistingCustomer\}/);
  assert.match(readFileSync("src/components/leads/customer-history-widget.tsx", "utf8"), /Use Customer Data/);
});
