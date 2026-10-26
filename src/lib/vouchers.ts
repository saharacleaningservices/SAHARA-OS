// Proforma Invoice / Credit Note / Delivery Challan / Purchase Voucher (owner 2026-10-23). Pure rules: types, labels, totals, numbering.
import { fyOf } from "@/lib/fy";

export const VOUCHER_TYPES = ["PROFORMA", "CREDIT_NOTE", "DELIVERY_CHALLAN", "PURCHASE"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_META: Record<VoucherType, { label: string; plural: string; slug: string; prefix: string; pdfTitle: string; partyLabel: string; hasMoney: boolean }> = {
  PROFORMA: { label: "Proforma Invoice", plural: "Proforma Invoices", slug: "proforma-invoice", prefix: "PF", pdfTitle: "PROFORMA INVOICE", partyLabel: "Bill To", hasMoney: true },
  CREDIT_NOTE: { label: "Credit Note", plural: "Credit Notes", slug: "credit-note", prefix: "CN", pdfTitle: "CREDIT NOTE", partyLabel: "Credit To", hasMoney: true },
  DELIVERY_CHALLAN: { label: "Delivery Challan", plural: "Delivery Challans", slug: "delivery-challan", prefix: "DC", pdfTitle: "DELIVERY CHALLAN", partyLabel: "Deliver To", hasMoney: false },
  PURCHASE: { label: "Purchase Voucher", plural: "Purchase Vouchers", slug: "purchase-voucher", prefix: "PU", pdfTitle: "PURCHASE VOUCHER", partyLabel: "Vendor", hasMoney: true },
};

export const typeFromSlug = (slug: string): VoucherType | null => VOUCHER_TYPES.find((t) => VOUCHER_META[t].slug === slug) ?? null;

export type VoucherLine = { name: string; description?: string; qty: number; rate: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Totals exactly as the invoice dialog computes them: (lines − discount) + GST on the remainder, to the paisa. */
export function voucherTotals(lines: VoucherLine[], discount: number, isGst: boolean, gstPercent: number) {
  const subTotal = r2(lines.reduce((s, l) => s + l.qty * l.rate, 0));
  const disc = Math.min(Math.max(0, discount), subTotal);
  const taxable = r2(subTotal - disc);
  const pct = isGst ? gstPercent : 0;
  const gstAmount = r2((taxable * pct) / 100);
  return { subTotal, discount: disc, gstPercent: pct, gstAmount, totalAmount: r2(taxable + gstAmount) };
}

/** "PF/26-27/" for a voucher of this type dated in that financial year. */
export function numberPrefix(type: VoucherType, date: Date): string {
  const fy = fyOf(date);
  return `${VOUCHER_META[type].prefix}/${fy.slice(2, 4)}-${fy.slice(5)}/`;
}

/** The number after the highest existing one with this prefix ("PF/26-27/0007" → "PF/26-27/0008"). */
export function nextNumber(prefix: string, existing: string[]): string {
  const top = existing.reduce((m, n) => (n.startsWith(prefix) ? Math.max(m, Number(n.slice(prefix.length)) || 0) : m), 0);
  return `${prefix}${String(top + 1).padStart(4, "0")}`;
}

export const VOUCHER_STATUSES = ["ISSUED", "PAID", "CANCELLED"] as const;
