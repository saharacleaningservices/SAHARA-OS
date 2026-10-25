// The single-page A4 quotation / invoice PDFs, built from the database. One implementation for the CRM routes (signed-in office roles)
// and the customer routes (the booking token is the credential) so the two can never drift apart.
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { SaharaBillDocument } from "@/lib/pdf/sahara-bill-document";
import { billChrome } from "@/server/bill-pdf";
import { billTable, documentScope, rupeesInWords } from "@/lib/document-scope";
import { MSMED_NOTE, modernizePaymentTerms, quotationWhatsAppLink, resolveQuotationTerms } from "@/lib/quotation-template";
import { paymentSplit } from "@/lib/booking-payment";
import { QUOTATION_TERMS, SERVICE_CATEGORY_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export type PdfFile = { buffer: Buffer; filename: string };

/** Quotation PDF. ID rule (owner 2026-10-24): the Lead / Booking ID only — no customer ID. */
export async function renderQuotationPdf(quotationId: string): Promise<PdfFile | null> {
  const quotation = await db.quotation.findUnique({ where: { id: quotationId }, include: { lead: true } });
  if (!quotation) return null;
  const services = JSON.parse(quotation.services) as { name: string; description: string; amount: number }[];
  const table = billTable(services, quotation.discount);
  const lead = quotation.lead;
  const scope = documentScope(
    {
      service: lead.service,
      packageName: lead.packageName,
      serviceVariant: lead.serviceVariant,
      serviceItems: lead.serviceItems,
      scopeOfWork: lead.scopeOfWork,
      scheduleDate: lead.serviceDate ? formatDate(lead.serviceDate) : null,
    },
    { standard: true }, // single-page standard quotation template (owner wording)
  );
  const chrome = await billChrome(quotation.totalAmount, quotation.quoteNumber);
  const buffer = await renderToBuffer(
    SaharaBillDocument({
      ...chrome,
      kind: "QUOTATION",
      title: "QUOTATION",
      number: quotation.quoteNumber,
      date: formatDate(quotation.createdAt),
      extraMeta: [...(quotation.validTill ? [{ label: "Valid Till", value: formatDate(quotation.validTill) }] : []), { label: "Lead ID", value: lead.leadNumber }],
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
      legalNote: MSMED_NOTE,
      whatsappConfirm: quotationWhatsAppLink(quotation.quoteNumber),
    }),
  );
  return { buffer, filename: `${quotation.quoteNumber}.pdf` };
}

/** Invoice PDF. ID rule (owner 2026-10-24): the Job ID only — no lead or customer ID. */
export async function renderInvoicePdf(invoiceId: string): Promise<PdfFile | null> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payment: true,
      job: {
        select: {
          jobNumber: true, propertyType: true, lead: { select: { email: true } }, service: true, packageName: true, serviceVariant: true, serviceItems: true, scopeOfWork: true, completedAt: true, scheduledDate: true,
          payments: { where: { deletedAt: null }, select: { paidAmount: true } },
        },
      },
    },
  });
  if (!invoice) return null;
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
  const chrome = await billChrome(balance, invoice.invoiceNumber);
  const buffer = await renderToBuffer(
    SaharaBillDocument({
      ...chrome,
      kind: "INVOICE",
      singlePage: true, // owner 2026-10-23: the invoice (with payment QR) must fit ONE A4 page too
      // No tax charged → Bill of Supply (as on Sahara's existing invoices); with GST → Tax Invoice.
      title: invoice.gstAmount > 0 ? "TAX INVOICE" : "BILL OF SUPPLY",
      copyLabel: "ORIGINAL FOR RECIPIENT",
      number: invoice.invoiceNumber,
      date: formatDate(invoice.createdAt),
      extraMeta: invoice.job ? [{ label: "Job ID", value: invoice.job.jobNumber }] : [],
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
  return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
}

export const pdfResponse = (f: PdfFile, download = false) =>
  new Response(new Uint8Array(f.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${f.filename.replace(/[^A-Za-z0-9._-]/g, "-")}"`, "Cache-Control": "private, no-store" },
  });
