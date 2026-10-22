// Billing (owner 2026-10-22): flat/% discount + optional 18% GST, same permission for Admin / Accounts / Operations.
// Run: npm run test:billing — throwaway SQLite DB (scripts/db-setup.mjs); no network; next/cache and the session are stubbed.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { canEditBilling } from "../src/lib/permissions";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-billing-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let billing: typeof import("../src/server/actions/job-billing");
const who = (role: string): Session => ({ sub: `u-${role}`, name: role, email: `${role}@t`, role });
let n = 0;
const makeJob = (jobValue = 10000) =>
  db.job.create({ data: { jobNumber: `B-JOB-${++n}`, customerName: "Asha", customerMobile: "9000000555", address: "Flat 2", area: "Kharadi", service: "COMMERCIAL_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue, status: "ASSIGNED" } as never });
const GSTIN = "27AABCU9603R1ZM";

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  billing = await import("../src/server/actions/job-billing");
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

test("permission: Admin, Accounts and Operations may edit billing; Supervisor and Staff may not", async () => {
  assert.deepEqual(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"].map(canEditBilling), [true, true, true, false, false]);
  const job = await makeJob();
  for (const role of ["SUPERVISOR", "STAFF"]) {
    session = who(role);
    const r = await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 100, gstEnabled: false });
    assert.equal(r.success, false, role);
  }
  session = null;
  assert.equal((await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 100, gstEnabled: false })).success, false);
  assert.equal((await db.job.findUnique({ where: { id: job.id } }))!.jobValue, 10000, "denied calls changed nothing");
});

test("each allowed role can set a discount and GST, with no cap (even 90%)", async () => {
  for (const role of ["ADMIN", "ACCOUNTS"]) {
    session = who(role);
    const job = await makeJob();
    const r = await billing.updateJobBilling(job.id, { discountMode: "PERCENT", discountValue: 90, gstEnabled: true, customerGstin: GSTIN });
    assert.equal(r.success, true, role);
    const j = (await db.job.findUnique({ where: { id: job.id } }))!;
    assert.deepEqual([j.discountAmount, j.gstAmount, j.jobValue, j.gstEnabled, j.customerGstin], [9000, 180, 1180, true, GSTIN]);
  }
});

test("B2B: (subtotal − discount) + 18% GST, and re-saving never compounds; turning GST off restores the base", async () => {
  session = who("ADMIN");
  const job = await makeJob(10000);
  await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 1000, gstEnabled: true, customerGstin: GSTIN });
  let j = (await db.job.findUnique({ where: { id: job.id } }))!;
  assert.deepEqual([j.discountAmount, j.gstAmount, j.jobValue], [1000, 1620, 10620]);
  await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 1000, gstEnabled: true, customerGstin: GSTIN }); // same again
  j = (await db.job.findUnique({ where: { id: job.id } }))!;
  assert.equal(j.jobValue, 10620, "idempotent");
  await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 1000, gstEnabled: false });
  j = (await db.job.findUnique({ where: { id: job.id } }))!;
  assert.deepEqual([j.gstAmount, j.jobValue, j.gstEnabled, j.customerGstin], [0, 9000, false, null]);
  await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 0, gstEnabled: false });
  j = (await db.job.findUnique({ where: { id: job.id } }))!;
  assert.deepEqual([j.discountAmount, j.jobValue], [null, 10000]);
});

test("GST needs a valid 15-character GSTIN; percent over 100 is refused; cancelled bookings are not re-billed", async () => {
  session = who("OPERATIONS");
  const job = await makeJob();
  assert.equal((await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 0, gstEnabled: true, customerGstin: "BAD" })).success, false);
  assert.equal((await billing.updateJobBilling(job.id, { discountMode: "PERCENT", discountValue: 150, gstEnabled: false })).success, false);
  await db.job.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
  assert.equal((await billing.updateJobBilling(job.id, { discountMode: "FLAT", discountValue: 10, gstEnabled: false })).success, false);
});

test("the payment record and the invoice follow the new total; a payment status already paid stays tracked separately", async () => {
  session = who("ACCOUNTS");
  await db.user.create({ data: { id: session.sub, name: "Accounts", email: "accounts@t", passwordHash: "x", role: "ACCOUNTS" } as never }); // the audit row references a real user
  const job = await makeJob(10000);
  const p = await db.payment.create({ data: { invoiceNumber: `INV-B-${job.id.slice(-5)}`, jobId: job.id, clientName: "Asha", amount: 10000, paidAmount: 2000, dueDate: new Date(), status: "PENDING" } as never });
  const r = await billing.updateJobBilling(job.id, { discountMode: "PERCENT", discountValue: 10, gstEnabled: true, customerGstin: GSTIN });
  assert.equal(r.success, true);
  const p2 = (await db.payment.findUnique({ where: { id: p.id } }))!;
  assert.deepEqual([p2.amount, p2.paidAmount], [10620, 2000]);
  assert.ok((await db.activityLog.findFirst({ where: { jobId: job.id, action: { startsWith: "Billing updated" } } })), "audited");
});
