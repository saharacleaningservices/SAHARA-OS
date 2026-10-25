import { db } from "@/lib/db";
import { collectAndPay } from "@/server/vouchers";
import { getCustomersPage } from "@/server/customers";

// Sales Dashboard (owner 2026-10-25, MyBillBook style): Total Business, Pending Collections, Paid Invoices and
// profile de-duplication on one screen. Read-only — every figure is computed from CRM invoices + imported
// MyBillBook invoices; nothing is written. A MyBillBook invoice that carries the same number as a CRM invoice is
// counted once (the CRM copy), so history imported from MyBillBook never double-counts.

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Start of the Indian financial year (1 April) that contains `d`. */
export function fyStart(d = new Date()): Date {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1);
}

export type PendingRow = { source: "CRM" | "MyBillBook"; number: string; party: string; date: Date; total: number; balance: number; href: string };

export type SalesDashboard = {
  fyLabel: string;
  totalBusiness: { allTime: number; fy: number; invoices: number };
  pending: { amount: number; count: number };
  paid: { amount: number; count: number };
  topPending: PendingRow[];
  dedup: { possibleDuplicates: number; mbbNeedChoice: number; mbbNoCustomer: number };
};

type CrmInv = { id: string; invoiceNumber: string; customerName: string; customerMobile: string | null; totalAmount: number; status: string; createdAt: Date; received: number; linked: boolean };

export function splitInvoices(crm: CrmInv[], mbb: { invoiceNo: string; contactName: string; invoiceDate: Date; amount: number; remaining: number; customerMobile: string | null }[], since: Date) {
  const crmNumbers = new Set(crm.map((i) => i.invoiceNumber.trim().toUpperCase()));
  const mbbOnly = mbb.filter((m) => !crmNumbers.has(m.invoiceNo.trim().toUpperCase()));
  let allTime = 0, fy = 0, paidAmount = 0, paidCount = 0;
  const pendingRows: PendingRow[] = [];
  for (const i of crm) {
    allTime += i.totalAmount;
    if (i.createdAt >= since) fy += i.totalAmount;
    const balance = Math.max(0, i.totalAmount - i.received);
    // Same rule as the Invoices page: a job/payment-linked invoice is paid when payments cover it; an unlinked one keeps its status.
    const isPaid = i.linked ? balance <= 0.01 && (i.received > 0 || i.totalAmount <= 0) : i.status === "PAID";
    if (isPaid) { paidAmount += i.totalAmount; paidCount++; }
    else pendingRows.push({ source: "CRM", number: i.invoiceNumber, party: i.customerName, date: i.createdAt, total: i.totalAmount, balance: r2(balance), href: i.customerMobile ? `/customers/${i.customerMobile.replace(/\D/g, "").slice(-10)}` : "/invoices" });
  }
  for (const m of mbbOnly) {
    allTime += m.amount;
    if (m.invoiceDate >= since) fy += m.amount;
    if (m.remaining <= 0.001) { paidAmount += m.amount; paidCount++; }
    else pendingRows.push({ source: "MyBillBook", number: m.invoiceNo, party: m.contactName, date: m.invoiceDate, total: m.amount, balance: r2(m.remaining), href: m.customerMobile ? `/customers/${m.customerMobile}` : "/customers/mybillbook-import" });
  }
  pendingRows.sort((a, b) => b.balance - a.balance);
  return { allTime: r2(allTime), fy: r2(fy), invoices: crm.length + mbbOnly.length, paidAmount: r2(paidAmount), paidCount, pendingRows };
}

export async function getSalesDashboard(): Promise<SalesDashboard> {
  const since = fyStart();
  const [crmRaw, mbbRaw, money, customers, needChoice, noCustomer] = await Promise.all([
    db.invoice.findMany({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: {
        id: true, invoiceNumber: true, customerName: true, customerMobile: true, totalAmount: true, status: true, createdAt: true,
        job: { select: { payments: { where: { deletedAt: null }, select: { paidAmount: true } } } },
        payment: { select: { paidAmount: true, deletedAt: true } },
      },
    }),
    db.mybillbookInvoice.findMany({ select: { invoiceNo: true, contactName: true, invoiceDate: true, amount: true, remaining: true, customer: { select: { mobile: true } } } }),
    collectAndPay(),
    getCustomersPage({ pageSize: 1 }),
    db.mybillbookInvoice.count({ where: { matchStatus: "REVIEW" } }),
    db.mybillbookInvoice.count({ where: { matchStatus: "UNMATCHED" } }),
  ]);
  const crm: CrmInv[] = crmRaw.map((i) => ({
    id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customerName, customerMobile: i.customerMobile, totalAmount: i.totalAmount, status: i.status, createdAt: i.createdAt,
    linked: !!i.job || !!i.payment,
    received: i.job ? i.job.payments.reduce((t, p) => t + (p.paidAmount ?? 0), 0) : i.payment && !i.payment.deletedAt ? i.payment.paidAmount : 0,
  }));
  const mbb = mbbRaw.map((m) => ({ invoiceNo: m.invoiceNo, contactName: m.contactName, invoiceDate: m.invoiceDate, amount: m.amount, remaining: m.remaining, customerMobile: m.customer?.mobile ?? null }));
  const s = splitInvoices(crm, mbb, since);
  const y = since.getFullYear();
  return {
    fyLabel: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
    totalBusiness: { allTime: s.allTime, fy: s.fy, invoices: s.invoices },
    // Pending uses the same rule as Parties → To Collect, so both screens always show the same number.
    pending: { amount: money.toCollect, count: money.toCollectCount },
    paid: { amount: s.paidAmount, count: s.paidCount },
    topPending: s.pendingRows.slice(0, 10),
    dedup: { possibleDuplicates: customers.counts.DUPLICATES ?? 0, mbbNeedChoice: needChoice, mbbNoCustomer: noCustomer },
  };
}
