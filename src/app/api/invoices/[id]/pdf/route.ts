import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { InvoiceDocument } from "@/lib/pdf/invoice-document";
import { formatDate } from "@/lib/utils";
import { COMPANY, QUOTATION_TERMS } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({ where: { id }, include: { payment: true } });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const services = JSON.parse(invoice.lineItems) as { name: string; description: string; amount: number }[];

  const upiString = `upi://pay?pa=sahara.cleaning@upi&pn=${encodeURIComponent(
    COMPANY.name
  )}&am=${invoice.totalAmount}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNumber)}`;
  const qrDataUrl = await QRCode.toDataURL(upiString, { margin: 1, width: 300 });

  const buffer = await renderToBuffer(
    InvoiceDocument({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: formatDate(invoice.createdAt),
      customerName: invoice.customerName,
      customerMobile: invoice.customerMobile || "—",
      customerAddress: invoice.customerAddress || "—",
      services,
      subTotal: invoice.subTotal,
      gstPercent: invoice.gstPercent,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.payment?.paidAmount ?? 0,
      terms: QUOTATION_TERMS,
      qrDataUrl,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
