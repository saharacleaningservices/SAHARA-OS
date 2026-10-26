// MyBillBook Sales Summary import (owner 2026-10-23). Run: npm run test:mybillbook
// Synthetic report rows only (no real customer data). Throwaway SQLite DB; no network.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { indexCustomersByName, matchByName, normalizeName, parseDmy, parseSalesSummaryCsv } from "../src/lib/mybillbook-import";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-mbb-"));
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
let act: typeof import("../src/server/actions/mybillbook-import");
let svc: typeof import("../src/server/mybillbook-import");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/mybillbook-import");
  svc = await import("../src/server/mybillbook-import");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const HEADER = "Invoice No,Invoice Date,Contact Name,Amount,Remaining Amount,Invoice Status,Due Date,Invoice Link,Payment Type,Party Category,Created by,Sq.Ft,eway_bill_number";
const row = (no: string, date: string, name: string, amt: number, rem: number, status: string, link: string) => `${no},${date},${name},${amt}.0,${rem}.0,${status},"",${link},credit,,Altaf Shaikh,"",""`;
const BANNER = "Company Name: TEST CO.\nPhone No: 9000000000\n\n\nSales Summary Report\nDated: 01/01/2020 - 21/10/2026\n\n\n\n\n\n";
const csv = (...rows: string[]) => `${BANNER}${HEADER}\n${rows.join("\n")}\n`;

test("parsing: finds the header under the company banner, reads dates / amounts / links, lists bad rows instead of guessing", () => {
  const r = parseSalesSummaryCsv(csv(
    row("T/1", "21/10/2026", "Ms. Asha Rao", 17500, 0, "Paid", "https://mybillbook.in/cpp/abc123"),
    row("T/2", "05/02/2024", "Mr. Ravi Kumar", 10000, 10000, "Unpaid", "https://mybillbook.in/i/144uzu8"),
    row("T/3", "31/02/2025", "Bad Date", 100, 0, "Paid", "https://mybillbook.in/i/x1"),
    row("T/4", "01/01/2025", "Bad Link", 100, 0, "Paid", "https://evil.example/pay"),
    row("T/1", "21/10/2026", "Same Number Other Invoice", 5, 0, "Paid", "https://mybillbook.in/i/dup"), // MyBillBook reuses numbers: kept, not dropped
    row("T/7", "21/10/2026", "Same Link Twice", 5, 0, "Paid", "https://mybillbook.in/i/dup"),
  ));
  assert.deepEqual(r.rows.map((x) => x.invoiceNo), ["T/1", "T/2", "T/1"]);
  assert.deepEqual(r.rows.map((x) => x.invoiceKey), ["cpp/abc123", "i/144uzu8", "i/dup"]);
  assert.deepEqual([r.rows[0].amount, r.rows[0].remaining, r.rows[0].status, r.rows[1].status], [17500, 0, "Paid", "Unpaid"]);
  assert.equal(r.rows[0].invoiceDate.toISOString().slice(0, 10), "2026-10-21");
  assert.equal(r.skipped.length, 3);
  assert.match(r.skipped.map((s) => s.reason).join("|"), /invalid invoice date.*not a MyBillBook link.*same invoice link appears twice/s);
  assert.equal(parseSalesSummaryCsv("hello,world").rows.length, 0);
  assert.equal(parseDmy("29/02/2025"), null, "no 29 Feb in 2025");
});

test("name normalisation drops honorifics, punctuation and case", () => {
  assert.equal(normalizeName("Mr. Janhavi  shah"), "janhavi shah");
  assert.equal(normalizeName("Ms. Kavita Agrawal"), "kavita agrawal");
  assert.equal(normalizeName("Dr. A. K. Rao"), "a k rao");
  assert.equal(normalizeName("Mr. Marzi Sir"), "marzi");
  assert.equal(normalizeName("Evolute Fintech Innovations PVT ltd"), "evolute fintech innovations pvt ltd");
});

test("safe match rule: one full name → attach; one-word or shared names → review; none → unmatched", () => {
  const idx = indexCustomersByName([{ id: "c1", name: "Kavita Agrawal" }, { id: "c2", name: "Amit Shah" }, { id: "c3", name: "amit shah" }, { id: "c4", name: "Marzi" }]);
  assert.deepEqual(matchByName("Ms. Kavita Agrawal", idx), { status: "MATCHED", customerId: "c1" });
  assert.deepEqual(matchByName("Mr. Amit Shah", idx), { status: "REVIEW", candidateIds: ["c2", "c3"] });
  assert.deepEqual(matchByName("Mr. Marzi Sir", idx), { status: "REVIEW", candidateIds: ["c4"] }, "a single word is never auto-attached");
  assert.deepEqual(matchByName("Nobody Known", idx), { status: "UNMATCHED" });
});

test("only the Super Admin can import or assign", async () => {
  for (const role of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) {
    session = { sub: "u", name: role, email: "e@t", role };
    assert.equal((await act.importMybillbookReport(csv(row("T/9", "01/01/2026", "A B", 1, 0, "Paid", "https://mybillbook.in/i/z")))).success, false, role);
    assert.equal((await act.assignMybillbookInvoice({ invoiceKey: "i/z", mobile: "9000000001" })).success, false, role);
  }
  session = null;
  assert.equal((await act.importMybillbookReport("x")).success, false);
  assert.equal(await db.mybillbookInvoice.count(), 0, "denied calls stored nothing");
});

test("import: attaches safe matches, queues the rest, uses a CRM payment's invoice number first, and never duplicates on re-import", async () => {
  session = { sub: "a", name: "Altaf", email: "a@t", role: "ADMIN" };
  const mk = (name: string, mobile: string) => db.customer.create({ data: { name, mobile, contactType: "CUSTOMER" } as never });
  const kavita = await mk("Kavita Agrawal", "9000000101");
  await mk("Amit Shah", "9000000102"); await mk("Amit Shah", "9000000103");
  const viaJob = await mk("Completely Different Name", "9000000104");
  const job = await db.job.create({ data: { jobNumber: "MB-JOB-1", customerName: "Completely Different Name", customerMobile: "9000000104", address: "x", area: "Baner", service: "PEST_CONTROL", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 3000, status: "COMPLETED" } as never });
  await db.payment.create({ data: { invoiceNumber: "PAY-MB-1", jobId: job.id, clientName: "x", amount: 3000, paidAmount: 3000, dueDate: new Date(), status: "PAID", mybillbookInvoiceNo: "SC/SL/26-27/3" } as never });

  const file = csv(
    row("SC/SL/26-27/1", "21/10/2026", "Ms. Kavita Agrawal", 17500, 0, "Paid", "https://mybillbook.in/cpp/kav1"),
    row("SC/SL/26-27/2", "20/10/2026", "Mr. Amit Shah", 8000, 0, "Paid", "https://mybillbook.in/cpp/amit1"),
    row("SC/SL/26-27/3", "19/10/2026", "Mr. Someone Else Entirely", 3000, 0, "Paid", "https://mybillbook.in/cpp/job1"),
    row("SC/SL/26-27/4", "18/10/2026", "Mr. Unknown Person", 4000, 4000, "Unpaid", "https://mybillbook.in/i/unk1"),
  );
  const r1 = await act.importMybillbookReport(file);
  assert.ok(r1.success);
  if (!r1.success) return;
  assert.deepEqual([r1.summary.created, r1.summary.updated, r1.summary.matched, r1.summary.needsReview, r1.summary.unmatched], [4, 0, 2, 1, 1]);
  const KEY: Record<string, string> = { "SC/SL/26-27/1": "cpp/kav1", "SC/SL/26-27/2": "cpp/amit1", "SC/SL/26-27/3": "cpp/job1", "SC/SL/26-27/4": "i/unk1" };
  const by = async (no: string) => (await db.mybillbookInvoice.findUnique({ where: { invoiceKey: KEY[no] } }))!;
  assert.deepEqual([(await by("SC/SL/26-27/1")).customerId, (await by("SC/SL/26-27/1")).matchMethod], [kavita.id, "NAME"]);
  const j = await by("SC/SL/26-27/3");
  assert.deepEqual([j.customerId, j.matchMethod, j.jobId, j.serviceName], [viaJob.id, "INVOICE_NO", job.id, "Pest Control"], "the CRM invoice number wins over a different name; service comes from the CRM job");
  assert.equal((await by("SC/SL/26-27/2")).matchStatus, "REVIEW");
  assert.equal(JSON.parse((await by("SC/SL/26-27/2")).candidateIds!).length, 2);
  assert.equal((await by("SC/SL/26-27/4")).matchStatus, "UNMATCHED");

  // Re-import of the same file: no duplicates, nothing "updated".
  const r2 = await act.importMybillbookReport(file);
  assert.ok(r2.success && r2.summary.created === 0 && r2.summary.updated === 0 && r2.summary.unchanged === 4);
  assert.equal(await db.mybillbookInvoice.count(), 4);

  // An admin resolves the ambiguous one; a later import (with money changed in MyBillBook) updates the numbers but keeps the assignment.
  assert.equal((await act.assignMybillbookInvoice({ invoiceKey: "cpp/amit1", mobile: "9000000103" })).success, true);
  const changed = file.replace("8000.0,0.0,Paid", "8000.0,1500.0,Unpaid");
  const r3 = await act.importMybillbookReport(changed);
  assert.ok(r3.success && r3.summary.updated === 1 && r3.summary.created === 0);
  const a = await by("SC/SL/26-27/2");
  assert.deepEqual([a.matchStatus, a.remaining, a.status], ["MANUAL", 1500, "Unpaid"]);
  assert.equal((await db.customer.findUnique({ where: { id: a.customerId! } }))!.mobile, "9000000103");

  // Wrong mobile is refused; detaching sends the row back to the review list.
  assert.equal((await act.assignMybillbookInvoice({ invoiceKey: "i/unk1", mobile: "9111111111" })).success, false);
  assert.equal((await act.detachMybillbookInvoice("cpp/amit1")).success, true);
  assert.deepEqual([(await by("SC/SL/26-27/2")).customerId, (await by("SC/SL/26-27/2")).matchStatus], [null, "UNMATCHED"]);
  assert.ok(await db.auditLog.findFirst({ where: { entityType: "MybillbookImport" } }), "the import is audited");
});

test("unknown file shape and an oversized file are refused with a clear message", async () => {
  session = { sub: "a", name: "Altaf", email: "a@t", role: "ADMIN" };
  const bad = await act.importMybillbookReport("name,phone\nA,9\n");
  assert.equal(bad.success, false);
  const big = await act.importMybillbookReport("x".repeat(5 * 1024 * 1024 + 10));
  assert.equal(big.success, false);
  assert.match((big as { error: string }).error, /too large/);
  void svc;
});

test("a reused invoice number keeps BOTH invoices (real file: number 53 on two different invoices); a CRM payment is not guessed onto either", async () => {
  session = { sub: "a", name: "Altaf", email: "a@t", role: "ADMIN" };
  const cust = await db.customer.create({ data: { name: "Reused Number", mobile: "9000000201", contactType: "CUSTOMER" } as never });
  const job = await db.job.create({ data: { jobNumber: "MB-JOB-2", customerName: "Reused Number", customerMobile: "9000000201", address: "x", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 100, status: "COMPLETED" } as never });
  await db.payment.create({ data: { invoiceNumber: "PAY-MB-2", jobId: job.id, clientName: "x", amount: 100, paidAmount: 100, dueDate: new Date(), status: "PAID", mybillbookInvoiceNo: "53" } as never });
  const file = csv(row("53", "23/02/2021", "Some Other Person", 5664, 0, "Paid", "https://mybillbook.in/i/116dkox"), row("53", "23/02/2021", "Another Other Person", 1888, 0, "Paid", "https://mybillbook.in/i/rojf9a"));
  const r = await act.importMybillbookReport(file);
  assert.ok(r.success && r.summary.created === 2 && r.summary.skipped.length === 0);
  const both = await db.mybillbookInvoice.findMany({ where: { invoiceNo: "53" } });
  assert.deepEqual(both.map((x) => x.amount).sort(), [1888, 5664]);
  assert.ok(both.every((x) => x.customerId !== cust.id && x.jobId === null), "the shared number is not matched through the CRM payment");
  void job;
});

test("GST book: differently-worded headers + GSTIN column parse, rows are tagged GST, re-import with the B2C book never duplicates or retags a link", async () => {
  const gstCsv = `Company Name: GST CO.\n\nInvoice Number,Date,Party Name,GSTIN,Total Amount,Balance Amount,Status,Invoice Link\nG/1,05/08/2024,Acme Traders Pvt Ltd,27ABCDE1234F1Z5,11800,0,Paid,https://mybillbook.in/i/gst0001\nG/2,06/08/2024,Beta Corp,,5900,5900,Unpaid,https://mybillbook.in/i/gst0002\n`;
  const p = parseSalesSummaryCsv(gstCsv);
  assert.equal(p.skipped.length, 0);
  assert.deepEqual(p.rows.map((r) => [r.invoiceNo, r.contactName, r.amount, r.remaining, r.status, r.gstin]), [["G/1", "Acme Traders Pvt Ltd", 11800, 0, "Paid", "27ABCDE1234F1Z5"], ["G/2", "Beta Corp", 5900, 5900, "Unpaid", null]]);
  const s = await svc.importMybillbookCsv(gstCsv, "gst1", "GST");
  assert.equal(s.created, 2);
  const row = await db.mybillbookInvoice.findUniqueOrThrow({ where: { invoiceKey: "i/gst0001" } });
  assert.deepEqual([row.dataset, row.gstin], ["GST", "27ABCDE1234F1Z5"]);
  const again = await svc.importMybillbookCsv(gstCsv, "gst2", "GST");
  assert.deepEqual([again.created, again.updated, again.unchanged], [0, 0, 2]);
});

test("importer UI backend: preview shows recognised columns + what would happen (writes nothing); Excel workbooks convert to the same rows; Admin only", async () => {
  const XLSX = await import("xlsx");
  const gst = `Company Name: GST CO.\n\nInvoice No,Invoice Date,Contact Name,Amount,Remaining Amount,Invoice Status,Due Date,Invoice Link,Payment Type,Party Category,Created by,Shipping Address,po_number\n81,12/09/2021,Acme Pvt Ltd,12390.0,0.0,Paid,12/09/2021,https://billbk.in/w/pvw0001,cash,,Altaf,"",""\n82,14/09/2021,Beta Corp,7080.0,7080.0,Unpaid,"",https://billbk.in/w/pvw0002,credit,,Altaf,"",""\n`;
  session = { sub: "x", name: "Staff", email: "s@x", role: "ACCOUNTS" };
  assert.equal((await act.previewMybillbookReport(gst)).success, false, "Accounts cannot preview/import");
  assert.equal((await act.convertMybillbookWorkbook("AAAA")).success, false);
  session = { sub: "a", name: "Altaf", email: "a@x", role: "ADMIN" };
  const before = await db.mybillbookInvoice.count();
  const r = await act.previewMybillbookReport(gst);
  assert.equal(r.success, true);
  const pv = (r as { success: true; preview: Awaited<ReturnType<typeof svc.previewMybillbookCsv>> }).preview;
  assert.deepEqual([pv.headerFound, pv.missingRequired, pv.rows, pv.newRows, pv.existingRows, pv.from, pv.to, pv.unpaidCount, pv.unpaidAmount, pv.withDueDate, pv.totalAmount], [true, [], 2, 2, 0, "2021-09-12", "2021-09-14", 1, 7080, 1, 19470]);
  assert.deepEqual(pv.linkKinds, { w: 2 });
  assert.equal(pv.columns.find((c) => c.field === "link")!.header, "Invoice Link");
  assert.equal(pv.columns.find((c) => c.field === "gstin")!.header, null);
  assert.equal(await db.mybillbookInvoice.count(), before, "a preview writes nothing");
  const noLink = await act.previewMybillbookReport("Invoice No,Invoice Date,Contact Name,Amount\n1,01/01/2024,X,5\n");
  assert.deepEqual((noLink as { success: true; preview: typeof pv }).preview.missingRequired, ["Invoice link"]);
  assert.equal(((await act.previewMybillbookReport("not a report")) as { success: true; preview: typeof pv }).preview.headerFound, false);

  // Excel: a workbook whose first sheet is the same report becomes the same rows (dates as text dd/mm/yyyy).
  const ws = XLSX.utils.aoa_to_sheet([["Company Name: GST CO."], [], ["Invoice No", "Invoice Date", "Contact Name", "Amount", "Remaining Amount", "Invoice Status", "Due Date", "Invoice Link"], ["81", "12/09/2021", "Acme Pvt Ltd", 12390, 0, "Paid", "12/09/2021", "https://billbk.in/w/pvw0001"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  const conv = await act.convertMybillbookWorkbook((XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64"));
  assert.equal(conv.success, true);
  const rows = parseSalesSummaryCsv((conv as { success: true; csv: string }).csv).rows;
  assert.deepEqual(rows.map((x) => [x.invoiceNo, x.contactName, x.amount, x.invoiceKey, x.invoiceDate.toISOString().slice(0, 10)]), [["81", "Acme Pvt Ltd", 12390, "w/pvw0001", "2021-09-12"]]);
});

test("edge cases: date layouts incl. Excel serials, BOM + CRLF, Indian-format amounts, Total footer rows, multi-sheet Excel with real date cells", async () => {
  const iso = (s: string) => parseDmy(s)?.toISOString().slice(0, 10) ?? null;
  assert.deepEqual(["21/10/2026", "21-10-2026", "21.10.26", "2026-10-21", "21 Oct 2026", "21-Oct-26", "2026-10-21T00:00:00.000Z", "46316"].map(iso), Array(8).fill("2026-10-21"));
  assert.deepEqual(["", "31/04/2026", "10/21/2026", "99999", "yesterday", "21/10/1999"].map(iso), [null, null, null, null, null, null]);

  const text = `\uFEFFCompany Name: X\r\n\r\nInvoice Number,Date,Party Name,Total Amount,Balance Amount,Status,Invoice Link\r\n1,05/08/2024,"Acme, Pvt Ltd","1,23,456.50","₹ 1,000",Unpaid,https://billbk.in/w/edge001\r\n2,2024-08-06,Beta,5900,0,Paid,https://mybillbook.in/cpp/edge002\r\nTotal,,,129356.50,,,\r\n,,,,,,\r\n`;
  const p = parseSalesSummaryCsv(text);
  assert.equal(p.skipped.length, 0, JSON.stringify(p.skipped));
  assert.deepEqual(p.rows.map((r) => [r.invoiceNo, r.contactName, r.amount, r.remaining, r.status, r.invoiceKey]), [["1", "Acme, Pvt Ltd", 123456.5, 1000, "Unpaid", "w/edge001"], ["2", "Beta", 5900, 0, "Paid", "cpp/edge002"]]);

  // Excel: a cover sheet first, the report on the second sheet, real date cells shown in the US layout.
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Summary only"], ["nothing here"]]), "Cover");
  const ws = XLSX.utils.aoa_to_sheet([["Sales Summary Report"], [], ["Invoice No", "Invoice Date", "Contact Name", "Amount", "Remaining Amount", "Invoice Status", "Invoice Link"], ["7", new Date(Date.UTC(2026, 9, 21, 6, 30)), "Gamma", 2500, 0, "Paid", "https://billbk.in/w/edge007"], ["Total", null, null, 2500, null, null, null]], { cellDates: true });
  ws["B4"].z = "m/d/yy"; // shown as 10/21/26 in Excel
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  session = { sub: "a", name: "Altaf", email: "a@x", role: "ADMIN" };
  const conv = await act.convertMybillbookWorkbook((XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64"));
  assert.equal(conv.success, true, JSON.stringify(conv));
  const rows = parseSalesSummaryCsv((conv as { success: true; csv: string }).csv).rows;
  assert.deepEqual(rows.map((r) => [r.invoiceNo, r.invoiceDate.toISOString().slice(0, 10), r.amount]), [["7", "2026-10-21", 2500]]);
  const none = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(none, XLSX.utils.aoa_to_sheet([["x"]]), "S");
  const bad = await act.convertMybillbookWorkbook((XLSX.write(none, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64"));
  assert.equal(bad.success, false);
  assert.equal((await act.convertMybillbookWorkbook(Buffer.from("not a workbook at all").toString("base64"))).success === true, false);
});
