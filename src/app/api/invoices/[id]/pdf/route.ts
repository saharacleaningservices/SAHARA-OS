import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { InvoiceDocument } from "@/lib/pdf/invoice-document";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { getCompanySettings } from "@/server/settings";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { COMPANY, QUOTATION_TERMS } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Previously had NO auth check at all — anyone with the (hard-to-guess but
  // unauthenticated) URL could view a customer's name/mobile/address/amount
  // paid. Invoices are a Payments-adjacent financial document, so this
  // matches the Payments module's own access list — ADMIN/ACCOUNTS/
  // OPERATIONS only (Francis/SUPERVISOR was never given an invoice-facing
  // flow to begin with, so this changes nothing he could do before).
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(session.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const invoice = await db.invoice.findUnique({ where: { id }, include: { payment: true } });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const services = JSON.parse(invoice.lineItems) as { name: string; description: string; amount: number }[];

  const upiString = `upi://pay?pa=sahara.cleaning@upi&pn=${encodeURIComponent(
    COMPANY.name
  )}&am=${invoice.totalAmount}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNumber)}`;
  const qrDataUrl = await QRCode.toDataURL(upiString, { margin: 1, width: 300 });
  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);

  const buffer = await renderToBuffer(
    InvoiceDocument({
      invoiceNumber: invoice.invoiceNumber,
      logoDataUrl,
      createdAt: formatDate(invoice.createdAt),
      customerName: invoice.customerName,
      customerMobile: invoice.customerMobile || "—",
      customerAddress: invoice.customerAddress || "—",
      services,
      subTotal: invoice.subTotal,
      discount: invoice.discount,
      gstPercent: invoice.gstPercent,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.payment?.paidAmount ?? 0,
      terms: invoice.terms || QUOTATION_TERMS,
      notes: invoice.notes,
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
