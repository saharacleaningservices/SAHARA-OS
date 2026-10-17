import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { SaharaBillDocument } from "@/lib/pdf/sahara-bill-document";
import { billChrome } from "@/server/bill-pdf";
import { billTable, documentScope, rupeesInWords } from "@/lib/document-scope";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { QUOTATION_TERMS, SERVICE_LABELS } from "@/lib/constants";
import { paymentSplit } from "@/lib/booking-payment";
import { customerNumberFor } from "@/server/customer-db";
import { modernizePaymentTerms } from "@/lib/quotation-template";

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
  // Customer mobile + amounts — Super Admin + Accounts only (owner rule 2026-10-08).
  if (!["ADMIN", "ACCOUNTS"].includes(session.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      payment: true,
      job: {
        select: {
          jobNumber: true, propertyType: true, lead: { select: { leadNumber: true, email: true } }, service: true, packageName: true, serviceVariant: true, serviceItems: true, scopeOfWork: true, completedAt: true, scheduledDate: true,
          payments: { where: { deletedAt: null }, select: { paidAmount: true } },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const services = JSON.parse(invoice.lineItems) as { name: string; description: string; amount: number }[];

  const table = billTable(services, invoice.discount);
  // Received = every payment recorded against the job (advance + later collections).
  const received = invoice.job ? invoice.job.payments.reduce((t, p) => t + (p.paidAmount ?? 0), 0) : (invoice.payment?.paidAmount ?? 0);
  const balance = Math.max(invoice.totalAmount - received, 0);
  const scope = invoice.job
    ? documentScope({
        service: invoice.job.service,
        packageName: invoice.job.packageName,
        serviceVariant: invoice.job.serviceVariant,
        serviceItems: invoice.job.serviceItems,
        scopeOfWork: invoice.job.scopeOfWork,
        scheduleDate: formatDate(invoice.job.completedAt ?? invoice.job.scheduledDate),
      })
    : { notes: invoice.notes ? [invoice.notes] : [], kindlyNote: [] };
  const [chrome, customerNumber] = await Promise.all([billChrome(balance, invoice.invoiceNumber), customerNumberFor(invoice.customerMobile)]);
  const buffer = await renderToBuffer(
    SaharaBillDocument({
      ...chrome,
      kind: "INVOICE",
      // No tax charged → Bill of Supply (as on Sahara's existing invoices); with GST → Tax Invoice.
      title: invoice.gstAmount > 0 ? "TAX INVOICE" : "BILL OF SUPPLY",
      copyLabel: "ORIGINAL FOR RECIPIENT",
      number: invoice.invoiceNumber,
      date: formatDate(invoice.createdAt),
      extraMeta: (invoice.job ? [{ label: "Job ID", value: invoice.job.jobNumber }, ...(invoice.job.lead ? [{ label: "Lead ID", value: invoice.job.lead.leadNumber }] : [])] : []).concat(customerNumber ? [{ label: "Customer ID", value: customerNumber }] : []),
      billTo: {
        name: invoice.customerName,
        address: invoice.customerAddress,
        mobile: invoice.customerMobile,
        email: invoice.job?.lead?.email ?? null,
        details: invoice.job
          ? [...(invoice.job.propertyType ? [{ label: "Property", value: invoice.job.propertyType }] : []), { label: "Service", value: SERVICE_LABELS[invoice.job.service as keyof typeof SERVICE_LABELS] ?? invoice.job.service }]
          : [],
      },
      paymentSplit: paymentSplit(invoice.totalAmount),
      rows: table.rows,
      subtotalRow: table.subtotal,
      totals: { subtotal: invoice.subTotal, discount: invoice.discount, gstPercent: invoice.gstPercent, gstAmount: invoice.gstAmount, total: invoice.totalAmount, received, balance },
      amountInWords: rupeesInWords(invoice.totalAmount),
      notes: scope.notes,
      kindlyNote: scope.kindlyNote,
      // Approved terms, minus the quotation-validity line (not meaningful on an invoice).
      terms: modernizePaymentTerms(invoice.terms || QUOTATION_TERMS)
        .split("\n")
        .filter((l) => !/quotation is valid/i.test(l))
        .join("\n"),
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
