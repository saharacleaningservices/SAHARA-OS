import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { SaharaBillDocument } from "@/lib/pdf/sahara-bill-document";
import { billChrome } from "@/server/bill-pdf";
import { billTable, documentScope, rupeesInWords } from "@/lib/document-scope";
import { resolveQuotationTerms } from "@/lib/quotation-template";
import { paymentSplit } from "@/lib/booking-payment";
import { customerNumberFor } from "@/server/customer-db";
import { SERVICE_CATEGORY_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";

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

  // Quotations carry the customer mobile and amounts — Super Admin + Accounts only (owner rule 2026-10-08).
  const allowed = ["ADMIN", "ACCOUNTS"].includes(session.role);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const services = JSON.parse(quotation.services) as { name: string; description: string; amount: number }[];

  const table = billTable(services, quotation.discount);
  const lead = quotation.lead;
  const scope = documentScope({
    service: lead.service,
    packageName: lead.packageName,
    serviceVariant: lead.serviceVariant,
    serviceItems: lead.serviceItems,
    scopeOfWork: lead.scopeOfWork,
    scheduleDate: lead.serviceDate ? formatDate(lead.serviceDate) : null,
  }, { standard: true }); // single-page standard quotation template (owner wording)
  const [chrome, customerNumber] = await Promise.all([billChrome(quotation.totalAmount, quotation.quoteNumber), customerNumberFor(lead.mobile)]);
  const buffer = await renderToBuffer(
    SaharaBillDocument({
      ...chrome,
      kind: "QUOTATION",
      title: "QUOTATION",
      number: quotation.quoteNumber,
      date: formatDate(quotation.createdAt),
      extraMeta: [...(quotation.validTill ? [{ label: "Valid Till", value: formatDate(quotation.validTill) }] : []), { label: "Lead ID", value: lead.leadNumber }, ...(customerNumber ? [{ label: "Customer ID", value: customerNumber }] : [])],
      billTo: {
        name: lead.name,
        address: lead.address || lead.area,
        mobile: lead.mobile,
        email: lead.email,
        details: [
          ...(lead.propertyType ? [{ label: "Property", value: lead.propertyType }] : []),
          { label: "Service", value: (lead.serviceCategory && SERVICE_CATEGORY_LABELS[lead.serviceCategory]) || SERVICE_LABELS[lead.service as keyof typeof SERVICE_LABELS] || lead.service },
        ],
      },
      paymentSplit: paymentSplit(quotation.totalAmount),
      rows: table.rows,
      subtotalRow: table.subtotal,
      totals: { subtotal: quotation.subTotal, discount: quotation.discount, gstPercent: quotation.gstPercent, gstAmount: quotation.gstAmount, total: quotation.totalAmount },
      amountInWords: rupeesInWords(quotation.totalAmount),
      notes: scope.notes,
      kindlyNote: scope.kindlyNote,
      terms: resolveQuotationTerms(quotation.terms).text,
      singlePage: true,
      exclusionsTitle: "Not Included (Exclusions)",
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.quoteNumber}.pdf"`,
    },
  });
}
