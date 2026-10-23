// Gathers one party's money history from the CRM (sales invoices, payments received, imported MyBillBook invoices, credit notes) into a
// ledger and an item-wise report. Super Admin / Accounts only — the callers enforce that. Not a "use server" module.
import { db } from "@/lib/db";
import { aggregateItems, buildLedger, type ItemLine, type LedgerEntry } from "@/lib/party-ledger";
import { parseStoredDetail } from "@/lib/mybillbook-detail";
import { normalizeMobile } from "@/server/customer-db";

export async function getPartyLedger(mobileRaw: string) {
  const mobile = normalizeMobile(mobileRaw) ?? mobileRaw.replace(/\D/g, "").slice(-10);
  const tail = mobile.slice(-4);
  const same = (m: string | null | undefined) => normalizeMobile(m) === mobile;
  const master = await db.customer.findUnique({ where: { mobile }, select: { id: true, name: true } }).catch(() => null);

  const [invoices, payments, mbb, credit] = await Promise.all([
    db.invoice.findMany({ where: { customerMobile: { contains: tail }, status: { not: "CANCELLED" } }, select: { id: true, invoiceNumber: true, jobId: true, createdAt: true, totalAmount: true, lineItems: true, customerMobile: true, customerName: true } }),
    db.payment.findMany({ where: { clientMobile: { contains: tail }, deletedAt: null, paidAmount: { gt: 0 } }, select: { invoiceNumber: true, paidAmount: true, paidDate: true, dueDate: true, mode: true, clientMobile: true, clientName: true } }),
    master ? db.mybillbookInvoice.findMany({ where: { customerId: master.id }, select: { invoiceNo: true, invoiceDate: true, amount: true, remaining: true, jobId: true, serviceName: true, detailJson: true } }) : Promise.resolve([]),
    master ? db.voucher.findMany({ where: { customerId: master.id, type: "CREDIT_NOTE", status: "ISSUED" }, select: { number: true, voucherDate: true, totalAmount: true, refNumber: true } }) : Promise.resolve([]),
  ]);

  const myInvoices = invoices.filter((i) => same(i.customerMobile));
  const invoicedJobs = new Set(myInvoices.map((i) => i.jobId).filter((j): j is string => !!j));
  const entries: LedgerEntry[] = [];
  const lines: ItemLine[] = [];

  for (const i of myInvoices) {
    entries.push({ date: i.createdAt, kind: "Sales Invoice", ref: i.invoiceNumber, debit: i.totalAmount, credit: 0 });
    try {
      for (const l of JSON.parse(i.lineItems) as { name?: string; qty?: number; amount?: number }[]) lines.push({ name: String(l.name ?? ""), qty: Number(l.qty) || 1, amount: Number(l.amount) || 0, date: i.createdAt, doc: i.invoiceNumber });
    } catch {
      /* unreadable line items: the invoice total still counts */
    }
  }
  for (const p of payments.filter((x) => same(x.clientMobile))) entries.push({ date: p.paidDate ?? p.dueDate, kind: "Payment In", ref: p.invoiceNumber, note: p.mode, debit: 0, credit: p.paidAmount });
  for (const m of mbb) {
    // An imported invoice that belongs to a CRM job which already has its own invoice is the same sale: not counted twice.
    if (m.jobId && invoicedJobs.has(m.jobId)) continue;
    entries.push({ date: m.invoiceDate, kind: "MyBillBook Invoice", ref: m.invoiceNo, note: m.serviceName, debit: m.amount, credit: 0 });
    const paid = Math.max(0, m.amount - m.remaining);
    if (paid > 0) entries.push({ date: m.invoiceDate, kind: "MyBillBook Payment", ref: m.invoiceNo, debit: 0, credit: paid });
    const d = parseStoredDetail(m.detailJson);
    for (const l of d?.lines ?? []) lines.push({ name: l.name, qty: l.qty, amount: l.amount, date: m.invoiceDate, doc: m.invoiceNo });
  }
  for (const c of credit) entries.push({ date: c.voucherDate, kind: "Credit Note", ref: c.number, note: c.refNumber ? `against ${c.refNumber}` : null, debit: 0, credit: c.totalAmount });

  return { name: master?.name ?? myInvoices[0]?.customerName ?? payments[0]?.clientName ?? "Customer", mobile, ledger: buildLedger(entries), items: aggregateItems(lines) };
}

export type PartyLedger = Awaited<ReturnType<typeof getPartyLedger>>;
