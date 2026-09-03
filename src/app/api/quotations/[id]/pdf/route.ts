import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { QuotationDocument } from "@/lib/pdf/quotation-document";
import { formatDate } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: true } });

  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const services = JSON.parse(quotation.services) as { name: string; description: string; amount: number }[];

  const upiString = `upi://pay?pa=sahara.cleaning@upi&pn=${encodeURIComponent(
    COMPANY.name
  )}&am=${quotation.totalAmount}&cu=INR&tn=${encodeURIComponent(quotation.quoteNumber)}`;
  const qrDataUrl = await QRCode.toDataURL(upiString, { margin: 1, width: 300 });

  const buffer = await renderToBuffer(
    QuotationDocument({
      quoteNumber: quotation.quoteNumber,
      createdAt: formatDate(quotation.createdAt),
      validTill: quotation.validTill ? formatDate(quotation.validTill) : "—",
      customerName: quotation.lead.name,
      customerMobile: quotation.lead.mobile,
      customerAddress: quotation.lead.address || quotation.lead.area,
      services,
      subTotal: quotation.subTotal,
      gstPercent: quotation.gstPercent,
      gstAmount: quotation.gstAmount,
      totalAmount: quotation.totalAmount,
      terms: quotation.terms,
      qrDataUrl,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.quoteNumber}.pdf"`,
    },
  });
}
