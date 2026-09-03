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

export async function generateCertificateNumber() {
  const count = await db.certificate.count();
  return nextNumber("CERT", count);
}

export async function generateEmployeeCode() {
  const count = await db.staff.count();
  return `SCS-${String(count + 1).padStart(3, "0")}`;
}
