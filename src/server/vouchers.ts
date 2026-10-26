// Voucher storage + the numbers behind the dashboard's To Collect / To Pay / Latest Transactions. Not a "use server" module — the
// Admin / Accounts entry points are in actions/vouchers.ts.
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nextNumber, numberPrefix, voucherTotals, type VoucherLine, type VoucherType } from "@/lib/vouchers";

export type VoucherInput = {
  type: VoucherType;
  voucherDate: Date;
  partyName: string;
  partyMobile?: string | null;
  partyGstin?: string | null;
  partyAddress?: string | null;
  customerId?: string | null;
  refNumber?: string | null;
  lines: VoucherLine[];
  discount: number;
  isGst: boolean;
  gstPercent: number;
  dueDate?: Date | null;
  notes?: string | null;
  createdByName?: string | null;
};

/** Creates a voucher with the next number for its type and financial year; a clash with a simultaneous create retries with a fresh number. */
export async function createVoucher(input: VoucherInput) {
  const t = voucherTotals(input.lines, input.discount, input.isGst, input.gstPercent);
  const prefix = numberPrefix(input.type, input.voucherDate);
  for (let attempt = 0; ; attempt++) {
    const existing = await db.voucher.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
    try {
      return await db.voucher.create({
        data: {
          type: input.type,
          number: nextNumber(prefix, existing.map((e) => e.number)),
          voucherDate: input.voucherDate,
          partyName: input.partyName.trim(),
          partyMobile: input.partyMobile?.trim() || null,
          partyGstin: input.partyGstin?.trim().toUpperCase() || null,
          partyAddress: input.partyAddress?.trim() || null,
          customerId: input.customerId ?? null,
          refNumber: input.refNumber?.trim() || null,
          lineItems: JSON.stringify(input.lines),
          subTotal: t.subTotal,
          discount: t.discount,
          isGst: input.isGst,
          gstPercent: t.gstPercent,
          gstAmount: t.gstAmount,
          totalAmount: t.totalAmount,
          dueDate: input.dueDate ?? null,
          notes: input.notes?.trim() || null,
          createdByName: input.createdByName ?? null,
        },
      });
    } catch (e) {
      const dup = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!dup || attempt >= 4) throw e;
    }
  }
}

export const listVouchers = (type: VoucherType) => db.voucher.findMany({ where: { type }, orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }], take: 300 });

/** Money paid out against a purchase voucher; PAID once the total is covered. Never more than what is owed. */
export async function recordPurchasePayment(id: string, amount: number) {
  const v = await db.voucher.findUnique({ where: { id } });
  if (!v || v.type !== "PURCHASE") return { ok: false as const, error: "Purchase voucher not found" };
  if (v.status === "CANCELLED") return { ok: false as const, error: "This voucher is cancelled" };
  const owed = Math.round((v.totalAmount - v.paidAmount) * 100) / 100;
  if (!(amount > 0) || amount > owed + 0.001) return { ok: false as const, error: `Enter an amount up to ${owed}` };
  const paid = Math.round((v.paidAmount + amount) * 100) / 100;
  await db.voucher.update({ where: { id }, data: { paidAmount: paid, status: paid >= v.totalAmount - 0.001 ? "PAID" : "ISSUED" } });
  return { ok: true as const, paid };
}

export async function cancelVoucher(id: string) {
  const v = await db.voucher.findUnique({ where: { id }, select: { id: true, status: true, paidAmount: true, type: true } });
  if (!v) return { ok: false as const, error: "Voucher not found" };
  if (v.type === "PURCHASE" && v.paidAmount > 0) return { ok: false as const, error: "A purchase with payments recorded cannot be cancelled" };
  await db.voucher.update({ where: { id }, data: { status: "CANCELLED" } });
  return { ok: true as const };
}

/**
 * Dashboard: To Collect = what customers still owe (CRM invoices not paid / cancelled, less what the job has received, plus the
 * balance on past MyBillBook invoices); To Pay = purchase vouchers not yet paid. Credit notes issued are shown separately, not
 * netted — they are tied to an invoice number by text only.
 */
export async function collectAndPay() {
  const [invoices, mbb, purchases, credit] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
      select: { totalAmount: true, job: { select: { payments: { where: { deletedAt: null }, select: { paidAmount: true } } } }, payment: { select: { paidAmount: true, deletedAt: true } } },
    }),
    db.mybillbookInvoice.aggregate({ where: { remaining: { gt: 0 } }, _sum: { remaining: true }, _count: { _all: true } }),
    db.voucher.findMany({ where: { type: "PURCHASE", status: "ISSUED" }, select: { totalAmount: true, paidAmount: true } }),
    db.voucher.aggregate({ where: { type: "CREDIT_NOTE", status: "ISSUED" }, _sum: { totalAmount: true }, _count: { _all: true } }),
  ]);
  const crmDue = invoices.reduce((s, i) => {
    const received = i.job ? i.job.payments.reduce((t, p) => t + (p.paidAmount ?? 0), 0) : i.payment && !i.payment.deletedAt ? i.payment.paidAmount : 0;
    return s + Math.max(0, i.totalAmount - received);
  }, 0);
  const toPay = purchases.reduce((s, p) => s + Math.max(0, p.totalAmount - p.paidAmount), 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    toCollect: r(crmDue + (mbb._sum.remaining ?? 0)),
    toCollectCount: invoices.length + mbb._count._all,
    toPay: r(toPay),
    toPayCount: purchases.length,
    creditNotes: r(credit._sum.totalAmount ?? 0),
    creditNoteCount: credit._count._all,
  };
}

export type LatestTransaction = { at: Date; kind: string; label: string; party: string; amount: number; direction: "in" | "out" | "doc" };

/** The most recent money movements across payments received, purchase vouchers and sales documents. */
export async function latestTransactions(limit = 8): Promise<LatestTransaction[]> {
  const [payments, vouchers, invoices] = await Promise.all([
    db.payment.findMany({ where: { deletedAt: null, status: "PAID", paidAmount: { gt: 0 } }, orderBy: { paidDate: "desc" }, take: limit, select: { paidDate: true, paidAmount: true, clientName: true, job: { select: { jobNumber: true, customerName: true } } } }),
    db.voucher.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: limit }),
    db.invoice.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: limit, select: { createdAt: true, invoiceNumber: true, customerName: true, totalAmount: true } }),
  ]);
  const rows: LatestTransaction[] = [
    ...payments.filter((p) => p.paidDate).map((p) => ({ at: p.paidDate as Date, kind: "Payment In", label: p.job?.jobNumber ?? "Payment", party: p.job?.customerName ?? p.clientName ?? "", amount: p.paidAmount, direction: "in" as const })),
    ...vouchers.map((v) => ({ at: v.createdAt, kind: v.type === "PURCHASE" ? "Purchase" : v.type === "CREDIT_NOTE" ? "Credit Note" : v.type === "PROFORMA" ? "Proforma" : "Delivery Challan", label: v.number, party: v.partyName, amount: v.totalAmount, direction: v.type === "PURCHASE" ? ("out" as const) : ("doc" as const) })),
    ...invoices.map((i) => ({ at: i.createdAt, kind: "Sales Invoice", label: i.invoiceNumber, party: i.customerName, amount: i.totalAmount, direction: "doc" as const })),
  ];
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
