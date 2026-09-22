import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { QuotationDocument } from "@/lib/pdf/quotation-document";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { getCompanySettings } from "@/server/settings";
import { getSession } from "@/lib/session";
import { canAccessLead } from "@/server/leads";
import { formatDate } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Previously had NO auth check at all — anyone with the (hard-to-guess but
  // unauthenticated) URL could view a customer's name/mobile/address/quoted
  // amount. Requires any signed-in ADMIN/ACCOUNTS/OPERATIONS session, or a
  // SUPERVISOR (Francis) whose own today/tomorrow lead scope covers this
  // quotation — mirroring the same allow-this-specific-record pattern
  // already used by the Job Card PDF route, so generating/viewing a
  // quotation for his own in-scope lead keeps working exactly as before.
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: true } });

  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const allowed =
    ["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(session.role) ||
    (session.role === "SUPERVISOR" && canAccessLead(session, quotation.lead));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const services = JSON.parse(quotation.services) as { name: string; description: string; amount: number }[];

  const upiString = `upi://pay?pa=sahara.cleaning@upi&pn=${encodeURIComponent(
    COMPANY.name
  )}&am=${quotation.totalAmount}&cu=INR&tn=${encodeURIComponent(quotation.quoteNumber)}`;
  const qrDataUrl = await QRCode.toDataURL(upiString, { margin: 1, width: 300 });
  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);

  const buffer = await renderToBuffer(
    QuotationDocument({
      quoteNumber: quotation.quoteNumber,
      logoDataUrl,
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
