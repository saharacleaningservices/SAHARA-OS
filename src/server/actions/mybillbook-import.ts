"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { assignInvoiceToCustomer, detachInvoice, importMybillbookCsv } from "@/server/mybillbook-import";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** Super Admin only: import the MyBillBook Sales Summary CSV (re-runnable — an invoice number is never stored twice). */
export async function importMybillbookReport(csvText: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can import MyBillBook history." };
  if (typeof csvText !== "string" || !csvText.trim()) return { success: false as const, error: "The file is empty." };
  if (csvText.length > MAX_CSV_BYTES) return { success: false as const, error: "The file is too large (5 MB maximum)." };
  const batchId = `mbb_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
  const summary = await importMybillbookCsv(csvText, batchId);
  if (summary.rowsInFile === 0) return { success: false as const, error: summary.skipped[0]?.reason ?? "No invoices found in the file." };
  await db.auditLog.create({ data: { entityType: "MybillbookImport", entityId: batchId, action: "IMPORT", summary: `MyBillBook history import: ${summary.created} new, ${summary.updated} updated, ${summary.matched} attached, ${summary.needsReview + summary.unmatched} for review`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  revalidatePath("/customers/mybillbook-import");
  return { success: true as const, summary };
}

const assignSchema = z.object({ invoiceKey: z.string().min(1).max(120), customerId: z.string().max(60).optional(), mobile: z.string().max(20).optional() });

/** Super Admin only: attach a waiting invoice to a customer chosen from its candidates, or by the customer's mobile number. */
export async function assignMybillbookInvoice(values: unknown) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can do this." };
  const p = assignSchema.safeParse(values);
  if (!p.success || (!p.data.customerId && !p.data.mobile)) return { success: false as const, error: "Choose a customer or enter a mobile number." };
  const r = await assignInvoiceToCustomer(p.data.invoiceKey, { customerId: p.data.customerId, mobile: p.data.mobile });
  if (!r.ok) return { success: false as const, error: r.error };
  revalidatePath("/customers/mybillbook-import");
  return { success: true as const, customerName: r.customerName };
}

/** Super Admin only: take an invoice off a customer's profile (wrong match) — it goes back to the review list. */
export async function detachMybillbookInvoice(invoiceKey: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can do this." };
  const r = await detachInvoice(String(invoiceKey));
  if (!r.ok) return { success: false as const, error: r.error };
  revalidatePath("/customers/mybillbook-import");
  return { success: true as const };
}
