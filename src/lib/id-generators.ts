import { db } from "@/lib/db";

async function nextNumber(prefix: string, count: number, pad = 4): Promise<string> {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(pad, "0");
  return `${prefix}-${year}-${seq}`;
}

export async function generateLeadNumber() {
  const count = await db.lead.count();
  return nextNumber("LD", count);
}

export async function generateJobNumber() {
  const count = await db.job.count();
  return nextNumber("JOB", count);
}

export async function generateQuoteNumber() {
  const count = await db.quotation.count();
  return nextNumber("QT", count);
}

export async function generateInvoiceNumber() {
  const count = await db.payment.count();
  return nextNumber("INV", count);
}

/**
 * For an Invoice created directly (not auto-generated alongside a Payment at
 * job completion, e.g. a manual invoice or one converted from a Quotation) —
 * takes the higher of the Payment/Invoice counts so its sequence can never
 * collide with generateInvoiceNumber()'s Payment-count-based numbering.
 */
export async function generateStandaloneInvoiceNumber() {
  const [paymentCount, invoiceCount] = await Promise.all([db.payment.count(), db.invoice.count()]);
  return nextNumber("INV", Math.max(paymentCount, invoiceCount));
}

export async function generateCertificateNumber() {
  const count = await db.certificate.count();
  return nextNumber("CERT", count);
}

/**
 * Permanent employee code SCS-001, SCS-002… = highest SCS number ever issued
 * (incl. soft-deleted / inactive staff) + 1, so a code is never reused even
 * after deletions. (A row count would hand out an existing code again.)
 */
export async function generateEmployeeCode() {
  const rows = await db.staff.findMany({ where: { employeeCode: { startsWith: "SCS-" } }, select: { employeeCode: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.employeeCode.slice(4)) || 0), 0);
  return `SCS-${String(max + 1).padStart(3, "0")}`;
}

export async function generateAmcNumber() {
  const count = await db.amcContract.count();
  return nextNumber("AMC", count);
}
