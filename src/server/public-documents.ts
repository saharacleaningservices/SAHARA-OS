// Customer-facing A4 PDFs, reached with the unguessable booking token (the same credential as the booking page). Not a "use server" module.
import { db } from "@/lib/db";
import { renderInvoicePdf, renderQuotationPdf, type PdfFile } from "@/server/document-pdf";

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;

/** The quotation PDF for a booking: the latest CRM quotation of its enquiry. Null when the booking has none. */
export async function quotationPdfForToken(token: string): Promise<PdfFile | null> {
  if (!TOKEN_RE.test(token)) return null;
  const job = await db.job.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { lead: { select: { quotations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } } } },
  });
  const id = job?.lead?.quotations[0]?.id;
  return id ? renderQuotationPdf(id) : null;
}

/** The final invoice PDF for a booking (exists once the job is completed). */
export async function invoicePdfForToken(token: string): Promise<PdfFile | null> {
  if (!TOKEN_RE.test(token)) return null;
  const job = await db.job.findFirst({ where: { publicToken: token, deletedAt: null }, select: { invoice: { select: { id: true, status: true } } } });
  if (!job?.invoice || job.invoice.status === "CANCELLED") return null;
  return renderInvoicePdf(job.invoice.id);
}
