import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { normalizeMobile } from "@/server/customer-db";
import { getCustomerServiceHistory } from "@/server/customer-service-history";

// Quick Search "Past History" popup (owner 2026-10-25): the last 3 services, the address and the total billed for one
// customer, from completed CRM jobs + imported MyBillBook invoices. Money + contact data — the API route serves it to
// ADMIN / ACCOUNTS only. A MyBillBook invoice whose number matches a CRM invoice is the same bill and is counted once.

export type QuickHistoryService = { date: Date; service: string; amount: number; ref: string; source: "CRM" | "MyBillBook" };
export type QuickHistory = {
  mobile: string;
  name: string;
  customerNumber: string | null;
  address: string | null;
  lastServices: QuickHistoryService[];
  totalBilled: number;
  billCount: number;
  outstanding: number;
};

const label = (s: string) => SERVICE_LABELS[s as keyof typeof SERVICE_LABELS] ?? s;

/** Merge CRM jobs and MyBillBook invoices into one newest-first list; same invoice number = one bill. Pure — unit-tested. */
export function mergeHistory(
  crm: { date: Date; service: string; amount: number; ref: string; invoiceNumber: string | null }[],
  mbb: { date: Date; service: string | null; amount: number; invoiceNo: string }[],
): { rows: QuickHistoryService[]; total: number } {
  const crmInvoiceNos = new Set(crm.map((c) => c.invoiceNumber?.trim().toUpperCase()).filter(Boolean));
  const rows: QuickHistoryService[] = [
    ...crm.map((c) => ({ date: c.date, service: c.service, amount: c.amount, ref: c.invoiceNumber ?? c.ref, source: "CRM" as const })),
    ...mbb
      .filter((m) => !crmInvoiceNos.has(m.invoiceNo.trim().toUpperCase()))
      .map((m) => ({ date: m.date, service: m.service?.trim() || "Service (MyBillBook)", amount: m.amount, ref: m.invoiceNo, source: "MyBillBook" as const })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  return { rows, total: Math.round(rows.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100 };
}

export async function getCustomerQuickHistory(mobileInput: string | null | undefined): Promise<QuickHistory | null> {
  const key = normalizeMobile(mobileInput);
  if (!key) return null;
  const [customer, crm, lastJob] = await Promise.all([
    db.customer.findUnique({ where: { mobile: key }, select: { id: true, name: true, address: true, area: true, customerNumber: true, outstandingBalance: true } }).catch(() => null),
    getCustomerServiceHistory(key, 200),
    db.job.findFirst({ where: { customerMobile: { contains: key.slice(-4) }, deletedAt: null }, orderBy: { scheduledDate: "desc" }, select: { customerName: true, customerMobile: true, address: true, area: true } }),
  ]);
  const mbb = await db.mybillbookInvoice.findMany({
    where: { OR: [...(customer ? [{ customerId: customer.id }] : []), { partyMobile: key }] },
    orderBy: { invoiceDate: "desc" },
    take: 200,
    select: { invoiceNo: true, invoiceDate: true, amount: true, remaining: true, serviceName: true, partyAddress: true, contactName: true },
  });
  if (!customer && crm.rows.length === 0 && mbb.length === 0) return null;

  const merged = mergeHistory(
    crm.rows.map((r) => ({ date: r.date, service: [label(r.service), r.packageName].filter(Boolean).join(" · "), amount: r.amount, ref: r.jobNumber, invoiceNumber: r.invoice?.number ?? null })),
    mbb.map((m) => ({ date: m.invoiceDate, service: m.serviceName, amount: m.amount, invoiceNo: m.invoiceNo })),
  );
  const jobMatches = lastJob && normalizeMobile(lastJob.customerMobile) === key;
  const address =
    [customer?.address, customer?.area].filter(Boolean).join(", ") ||
    (jobMatches ? [lastJob.address, lastJob.area].filter((x) => x && x !== "x").join(", ") : "") ||
    mbb.find((m) => m.partyAddress)?.partyAddress ||
    null;
  const mbbDue = mbb.reduce((s, m) => s + (m.remaining > 0 ? m.remaining : 0), 0);
  return {
    mobile: key,
    name: customer?.name || (jobMatches ? lastJob.customerName : "") || mbb[0]?.contactName || "Customer",
    customerNumber: customer?.customerNumber ?? null,
    address,
    lastServices: merged.rows.slice(0, 3),
    totalBilled: merged.total,
    billCount: merged.rows.length,
    outstanding: Math.round(Math.max(customer?.outstandingBalance ?? 0, mbbDue) * 100) / 100,
  };
}
