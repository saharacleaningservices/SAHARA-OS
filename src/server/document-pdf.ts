// The single-page A4 quotation / invoice PDFs, built from the database. One implementation for the CRM routes (signed-in office roles)
// and the customer routes (the booking token is the credential) so the two can never drift apart.
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { SaharaBillDocument } from "@/lib/pdf/sahara-bill-document";
import { SaharaInvoiceDocument } from "@/lib/pdf/sahara-invoice-document";
import { billChrome } from "@/server/bill-pdf";
import { billTable, documentScope, documentTotal, rupeesInWords } from "@/lib/document-scope";
import { MSMED_NOTE, quotationWhatsAppLink, resolveQuotationTerms } from "@/lib/quotation-template";
import { paymentSplit } from "@/lib/booking-payment";
import { COMPANY, SERVICE_CATEGORY_LABELS, SERVICE_LABELS } from "@/lib/constants";
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
  // "Zero Rupees" guard: the words always follow the total printed on the page; a stored 0 total with priced lines falls back to the lines.
  const quoteTotal = documentTotal(quotation.totalAmount, quotation.subTotal - quotation.discount + quotation.gstAmount, table.subtotal.total);
  const chrome = await billChrome(quoteTotal, quotation.quoteNumber);
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
      paymentSplit: paymentSplit(quoteTotal),
      rows: table.rows,
      subtotalRow: table.subtotal,
      totals: { subtotal: quotation.subTotal, discount: quotation.discount, gstPercent: quotation.gstPercent, gstAmount: quotation.gstAmount, total: quoteTotal },
      amountInWords: rupeesInWords(quoteTotal),
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
  const invoiceTotal = documentTotal(invoice.totalAmount, invoice.subTotal - invoice.discount + invoice.gstAmount, table.subtotal.total);
  const received = invoice.job ? invoice.job.payments.reduce((t, p) => t + (p.paidAmount ?? 0), 0) : (invoice.payment?.paidAmount ?? 0);
  const balance = Math.max(invoiceTotal - received, 0);
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
  // Commercial work is priced per sq. ft: show the area column only when a line really carries an area.
  const discountOnRow = (r: { disc: number }) => r.disc;
  const areaOf = (r: { name: string; detail?: string; qty: number }) => (/sq\.?\s*ft|sqft|square f/i.test(`${r.name} ${r.detail ?? ""}`) ? `${r.qty.toLocaleString("en-IN")} sq ft` : undefined);
  const rows = table.rows.map((r) => ({ name: r.name, detail: r.detail && !/sq\.?\s*ft|sqft|square f/i.test(r.detail) ? r.detail : undefined, qty: r.qty, rate: r.rate, total: r.total > 0 ? r.total + (discountOnRow(r) ) : 0, area: areaOf(r) }));
  // Discount appears once, in the summary (under Subtotal) — table rows are shown at their gross value.
  const discount = invoice.discount > 0 ? invoice.discount : 0;
  const scopeLines = scope.notes
    .map((n) => n.replace(/^[•\-\s]+/, "").trim())
    .filter((n) => n && !/^schedule date:/i.test(n) && !/package\s*[—-]\s*scope of work:?$/i.test(n))
    .slice(0, 10);
  const buffer = await renderToBuffer(
    SaharaInvoiceDocument({
      number: invoice.invoiceNumber,
      date: formatDate(invoice.createdAt),
      jobId: invoice.job?.jobNumber ?? null,
      company: { name: chrome.company.name, phones: chrome.company.phones ?? [chrome.company.phone], email: chrome.company.email, website: chrome.company.website, address: chrome.company.address, gstin: chrome.company.gstin ?? COMPANY.gstin },
      logoDataUrl: chrome.logoDataUrl,
      billTo: { name: invoice.customerName, address: invoice.customerAddress, mobile: invoice.customerMobile, email: invoice.job?.lead?.email ?? null },
      rows,
      showArea: rows.some((r) => !!r.area),
      totals: { subtotal: invoice.subTotal, discount, gstPercent: invoice.gstPercent, gstAmount: invoice.gstAmount, total: invoiceTotal, received, balance },
      amountInWords: rupeesInWords(invoiceTotal),
      // Payment block only while money is still due (bank left, UPI QR for the exact balance right).
      payment: balance > 0 ? { bank: chrome.bank, upiId: chrome.upiId, qrDataUrl: chrome.qrDataUrl, amount: chrome.qrAmount } : null,
      scope: scopeLines,
    }),
  );
  return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
}

export const pdfResponse = (f: PdfFile, download = false) =>
  new Response(new Uint8Array(f.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${f.filename.replace(/[^A-Za-z0-9._-]/g, "-")}"`, "Cache-Control": "private, no-store" },
  });
