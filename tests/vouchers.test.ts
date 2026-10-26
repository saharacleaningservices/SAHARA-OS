// Proforma / Credit Note / Delivery Challan / Purchase vouchers, GST toggle maths, To Collect / To Pay (owner 2026-10-23).
// Run: npx tsx --test tests/vouchers.test.ts   Synthetic data; throwaway DB; no network.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { nextNumber, numberPrefix, typeFromSlug, voucherTotals, VOUCHER_META } from "../src/lib/vouchers";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-vch-"));
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
let act: typeof import("../src/server/actions/vouchers");
let svc: typeof import("../src/server/vouchers");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/vouchers");
  svc = await import("../src/server/vouchers");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("pure: totals with the GST / Non-GST switch, numbering per type and financial year, slugs", () => {
  const lines = [{ name: "Deep Cleaning", qty: 1, rate: 10000 }, { name: "Sofa", qty: 5, rate: 200 }];
  assert.deepEqual(voucherTotals(lines, 1000, false, 18), { subTotal: 11000, discount: 1000, gstPercent: 0, gstAmount: 0, totalAmount: 10000 }); // Non-GST ignores the rate
  assert.deepEqual(voucherTotals(lines, 1000, true, 18), { subTotal: 11000, discount: 1000, gstPercent: 18, gstAmount: 1800, totalAmount: 11800 });
  assert.equal(voucherTotals(lines, 999999, false, 0).totalAmount, 0, "discount can never exceed the sub total");
  assert.equal(numberPrefix("PROFORMA", new Date("2026-10-23T05:00:00Z")), "PF/26-27/");
  assert.equal(numberPrefix("CREDIT_NOTE", new Date("2027-03-31T18:00:00Z")), "CN/26-27/");
  assert.equal(numberPrefix("PURCHASE", new Date("2027-03-31T19:00:00Z")), "PU/27-28/"); // 1 Apr 00:30 IST
  assert.equal(nextNumber("PF/26-27/", []), "PF/26-27/0001");
  assert.equal(nextNumber("PF/26-27/", ["PF/26-27/0009", "PF/26-27/0002", "CN/26-27/0050", "PF/25-26/0300"]), "PF/26-27/0010");
  assert.deepEqual(["proforma-invoice", "credit-note", "delivery-challan", "purchase-voucher", "x"].map((s) => typeFromSlug(s)), ["PROFORMA", "CREDIT_NOTE", "DELIVERY_CHALLAN", "PURCHASE", null]);
  assert.equal(VOUCHER_META.DELIVERY_CHALLAN.hasMoney, false);
});

const base = { voucherDate: "2026-10-23", partyName: "Acme Traders", lines: [{ name: "Office Deep Cleaning", qty: 1, rate: 10000 }], discount: 0, isGst: true, gstPercent: 18 };

test("access: only Super Admin and Accounts may create, pay or cancel vouchers", async () => {
  for (const role of ["OPERATIONS", "SUPERVISOR", "STAFF"]) {
    session = { sub: "u", name: "x", email: "x@x", role };
    assert.equal((await act.createVoucherAction({ type: "PROFORMA", ...base })).success, false, role);
  }
  session = null;
  assert.equal((await act.createVoucherAction({ type: "PROFORMA", ...base })).success, false);
  assert.equal(await db.voucher.count(), 0);
});

test("create all four types: numbering per type, GST on proforma / credit note, challan keeps no money, customer linked by mobile", async () => {
  session = { sub: "u1", name: "Shoyab Kazi", email: "a@x", role: "ACCOUNTS" };
  await db.customer.create({ data: { name: "Acme Traders", mobile: "9811111111", customerNumber: "C-1" } });
  const c = async (type: string, extra: Record<string, unknown> = {}) => {
    const r = await act.createVoucherAction({ type, ...base, ...extra });
    assert.equal(r.success, true, JSON.stringify(r));
    return r as { success: true; id: string; number: string };
  };
  const p1 = await c("PROFORMA", { partyMobile: "98111 11111" });
  const p2 = await c("PROFORMA");
  const cn = await c("CREDIT_NOTE", { refNumber: "SC/SL/26-27/1501", isGst: false, gstPercent: 0 });
  const dc = await c("DELIVERY_CHALLAN", { lines: [{ name: "Chemical drum", qty: 3, rate: 999 }], discount: 500 });
  const pu = await c("PURCHASE", { partyName: "Chem Supplies", refNumber: "INV-77", dueDate: "2026-11-05" });
  assert.deepEqual([p1.number, p2.number, cn.number, dc.number, pu.number], ["PF/26-27/0001", "PF/26-27/0002", "CN/26-27/0001", "DC/26-27/0001", "PU/26-27/0001"]);
  const row = (id: string) => db.voucher.findUniqueOrThrow({ where: { id } });
  const a = await row(p1.id);
  assert.deepEqual([a.subTotal, a.gstAmount, a.totalAmount, a.isGst, a.status], [10000, 1800, 11800, true, "ISSUED"]);
  assert.ok(a.customerId, "linked to the existing customer by mobile");
  assert.equal((await row(p2.id)).customerId, null);
  const credit = await row(cn.id);
  assert.deepEqual([credit.isGst, credit.gstAmount, credit.totalAmount, credit.refNumber], [false, 0, 10000, "SC/SL/26-27/1501"]);
  const ch = await row(dc.id);
  assert.deepEqual([ch.subTotal, ch.discount, ch.totalAmount, ch.isGst], [0, 0, 0, false]); // quantities only
  assert.equal(JSON.parse(ch.lineItems)[0].qty, 3);
  assert.equal((await row(pu.id)).customerId, null);
  assert.equal(await db.auditLog.count({ where: { entityType: "Voucher", action: "CREATE" } }), 5);
  assert.equal((await act.createVoucherAction({ type: "PROFORMA", ...base, lines: [{ name: "x", qty: 1, rate: 0 }] })).success, false, "a money document needs a rate");
  assert.equal((await act.createVoucherAction({ type: "PROFORMA", ...base, partyName: "" })).success, false);
});

test("purchase payments, cancel rules, To Collect / To Pay and Latest Transactions", async () => {
  const pu = await db.voucher.findFirstOrThrow({ where: { type: "PURCHASE" } }); // 11,800
  assert.equal((await act.payPurchaseVoucher(pu.id, 20000)).success, false, "cannot pay more than is owed");
  assert.equal((await act.payPurchaseVoucher(pu.id, 0)).success, false);
  assert.equal((await act.payPurchaseVoucher(pu.id, 5000)).success, true);
  let m = await svc.collectAndPay();
  assert.equal(m.toPay, 6800);
  assert.equal(m.toPayCount, 1);
  assert.equal((await act.cancelVoucherAction(pu.id)).success, false, "a part-paid purchase cannot be cancelled");
  assert.equal((await act.payPurchaseVoucher(pu.id, 6800)).success, true);
  assert.equal((await db.voucher.findUniqueOrThrow({ where: { id: pu.id } })).status, "PAID");
  m = await svc.collectAndPay();
  assert.deepEqual([m.toPay, m.toPayCount], [0, 0]);

  // To Collect: unpaid CRM invoice (less what the job received) + MyBillBook balances; credit notes are reported, not netted.
  const job = await db.job.create({ data: { jobNumber: "J-1", customerName: "Asha", customerMobile: "9822222222", address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 5000, status: "COMPLETED" } as never });
  await db.payment.create({ data: { jobId: job.id, clientName: "Asha", invoiceNumber: "PAY-1", amount: 5000, paidAmount: 2000, dueDate: new Date(), status: "PAID", paidDate: new Date() } as never });
  await db.invoice.create({ data: { invoiceNumber: "INV-1", jobId: job.id, customerName: "Asha", lineItems: "[]", subTotal: 5000, totalAmount: 5000, status: "PARTIALLY_PAID" } });
  await db.mybillbookInvoice.create({ data: { invoiceNo: "H1", invoiceKey: "i/h1", invoiceDate: new Date(), contactName: "Acme", amount: 3000, remaining: 3000, status: "Unpaid", invoiceLink: "https://mybillbook.in/i/h1" } });
  m = await svc.collectAndPay();
  assert.deepEqual([m.toCollect, m.toCollectCount, m.creditNoteCount, m.creditNotes], [6000, 2, 1, 10000]);
  const cn = await db.voucher.findFirstOrThrow({ where: { type: "CREDIT_NOTE" } });
  assert.equal((await act.cancelVoucherAction(cn.id)).success, true);
  assert.equal((await svc.collectAndPay()).creditNoteCount, 0);

  const latest = await svc.latestTransactions(20);
  assert.ok(latest.some((t) => t.kind === "Payment In" && t.direction === "in" && t.amount === 2000));
  assert.ok(latest.some((t) => t.kind === "Purchase" && t.direction === "out"));
  assert.ok(!latest.some((t) => t.label === cn.number), "cancelled vouchers are not listed");
  assert.deepEqual([...latest].sort((x, y) => y.at.getTime() - x.at.getTime()).map((t) => t.at.getTime()), latest.map((t) => t.at.getTime()), "newest first");
});
