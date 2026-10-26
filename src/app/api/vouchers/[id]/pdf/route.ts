import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { VoucherDocument } from "@/lib/pdf/voucher-document";
import { VOUCHER_META, type VoucherLine, type VoucherType } from "@/lib/vouchers";
import { rupeesInWords } from "@/lib/document-scope";
import { billChrome } from "@/server/bill-pdf";
import { formatDate } from "@/lib/utils";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Voucher PDF — Super Admin + Accounts only (money documents, same gate as the invoice PDF). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "ACCOUNTS"].includes(session.role)) return new NextResponse("Forbidden", { status: 403 });
  const v = await db.voucher.findUnique({ where: { id } });
  if (!v) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  const meta = VOUCHER_META[v.type as VoucherType];
  const lines = (JSON.parse(v.lineItems) as VoucherLine[]).map((l) => ({ ...l, amount: Math.round(l.qty * l.rate * 100) / 100 }));
  const chrome = await billChrome(Math.max(0, v.totalAmount - v.paidAmount), v.number);
  const buffer = await renderToBuffer(
    VoucherDocument({
      title: v.isGst && v.type === "PROFORMA" ? "PROFORMA TAX INVOICE" : meta.pdfTitle,
      number: v.number,
      date: formatDate(v.voucherDate),
      partyLabel: meta.partyLabel,
      company: chrome.company,
      logoDataUrl: chrome.logoDataUrl,
      party: { name: v.partyName, mobile: v.partyMobile, gstin: v.partyGstin, address: v.partyAddress },
      refLabel: v.type === "CREDIT_NOTE" ? "Against invoice" : v.type === "PURCHASE" ? "Vendor bill no" : "Reference",
      refNumber: v.refNumber,
      dueDate: v.dueDate ? formatDate(v.dueDate) : null,
      lines,
      hasMoney: meta.hasMoney,
      totals: { subTotal: v.subTotal, discount: v.discount, isGst: v.isGst, gstPercent: v.gstPercent, gstAmount: v.gstAmount, totalAmount: v.totalAmount, paidAmount: v.type === "PURCHASE" ? v.paidAmount : 0 },
      fmt: rs,
      words: meta.hasMoney ? rupeesInWords(v.totalAmount) : undefined,
      notes: v.notes,
      cancelled: v.status === "CANCELLED",
    }),
  );
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${v.number.replace(/\//g, "-")}.pdf"` } });
}
