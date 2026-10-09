import { db } from "@/lib/db";

async function nextNumber(prefix: string, count: number, pad = 4, existing: (string | null)[] = []): Promise<string> {
  const year = new Date().getFullYear();
  // Same sequence as before (row count + 1), but never below the highest number
  // already issued this year — so a deleted row or a second document type
  // sharing the sequence can't hand out a duplicate number.
  const head = `${prefix}-${year}-`;
  const maxIssued = existing.reduce((m, v) => (v && v.startsWith(head) && /^\d+$/.test(v.slice(head.length)) ? Math.max(m, Number(v.slice(head.length))) : m), 0);
  const seq = String(Math.max(count, maxIssued) + 1).padStart(pad, "0");
  return `${head}${seq}`;
}

const thisYear = (prefix: string) => ({ startsWith: `${prefix}-${new Date().getFullYear()}-` });

export async function generateLeadNumber() {
  const [count, rows] = await Promise.all([db.lead.count(), db.lead.findMany({ where: { leadNumber: thisYear("LD") }, select: { leadNumber: true } })]);
  return nextNumber("LD", count, 4, rows.map((r) => r.leadNumber));
}

export async function generateJobNumber() {
  const [count, rows] = await Promise.all([db.job.count(), db.job.findMany({ where: { jobNumber: thisYear("JOB") }, select: { jobNumber: true } })]);
  return nextNumber("JOB", count, 4, rows.map((r) => r.jobNumber));
}

export async function generateQuoteNumber() {
  const [count, rows] = await Promise.all([db.quotation.count(), db.quotation.findMany({ where: { quoteNumber: thisYear("QT") }, select: { quoteNumber: true } })]);
  return nextNumber("QT", count, 4, rows.map((r) => r.quoteNumber));
}

/** Payment rows and standalone Invoices share the INV sequence — check both tables. */
async function issuedInvoiceNumbers() {
  const [p, i] = await Promise.all([
    db.payment.findMany({ where: { invoiceNumber: thisYear("INV") }, select: { invoiceNumber: true } }),
    db.invoice.findMany({ where: { invoiceNumber: thisYear("INV") }, select: { invoiceNumber: true } }),
  ]);
  return [...p.map((r) => r.invoiceNumber), ...i.map((r) => r.invoiceNumber)];
}

export async function generateInvoiceNumber() {
  const [count, issued] = await Promise.all([db.payment.count(), issuedInvoiceNumbers()]);
  return nextNumber("INV", count, 4, issued);
}

/**
 * For an Invoice created directly (not auto-generated alongside a Payment at
 * job completion, e.g. a manual invoice or one converted from a Quotation) —
 * takes the higher of the Payment/Invoice counts so its sequence can never
 * collide with generateInvoiceNumber()'s Payment-count-based numbering.
 */
export async function generateStandaloneInvoiceNumber() {
  const [paymentCount, invoiceCount, issued] = await Promise.all([db.payment.count(), db.invoice.count(), issuedInvoiceNumbers()]);
  return nextNumber("INV", Math.max(paymentCount, invoiceCount), 4, issued);
}

export async function generateCertificateNumber() {
  const count = await db.certificate.count();
  return nextNumber("CERT", count);
}

/** SCS-0001…SCS-0021 are the owner-approved Employee ID master (server/employee-id-master.ts). */
export const EMPLOYEE_ID_RESERVED_UPTO = 21;

/**
 * Permanent Employee ID, format SCS-#### (owner rule 05-Oct-2026).
 * Next = highest SCS-#### ever issued (incl. soft-deleted / inactive staff) + 1,
 * never below the reserved master range, so an ID is never reused.
 * Legacy 3-digit codes (SCS-021…) are a different format and are ignored.
 */
export async function generateEmployeeCode() {
  const rows = await db.staff.findMany({ where: { employeeCode: { startsWith: "SCS-" } }, select: { employeeCode: true } });
  const max = rows.reduce((m, r) => (/^SCS-\d{4}$/.test(r.employeeCode) ? Math.max(m, Number(r.employeeCode.slice(4))) : m), EMPLOYEE_ID_RESERVED_UPTO);
  return `SCS-${String(max + 1).padStart(4, "0")}`;
}

export async function generateAmcNumber() {
  const count = await db.amcContract.count();
  return nextNumber("AMC", count);
}
