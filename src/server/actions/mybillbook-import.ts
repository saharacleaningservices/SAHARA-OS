"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { assignInvoiceToCustomer, createCustomersFromUnattached, detachInvoice, importMybillbookCsv } from "@/server/mybillbook-import";
import { startDetailFetch, stopDetailFetch } from "@/server/mybillbook-detail";
import { previewMybillbookCsv } from "@/server/mybillbook-import";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** Super Admin only: import the MyBillBook Sales Summary CSV (re-runnable — an invoice number is never stored twice). */
export async function importMybillbookReport(csvText: string, dataset: string = "B2C") {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can import MyBillBook history." };
  if (typeof csvText !== "string" || !csvText.trim()) return { success: false as const, error: "The file is empty." };
  if (csvText.length > MAX_CSV_BYTES) return { success: false as const, error: "The file is too large (5 MB maximum)." };
  const book = dataset === "GST" ? "gst" : "b2c";
  const batchId = `mbb_${book}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
  const summary = await importMybillbookCsv(csvText, batchId, dataset === "GST" ? "GST" : "B2C");
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

/** Super Admin only: read the service details of every imported invoice from its shared link (no MyBillBook login needed). Runs in the background. */
export async function startMybillbookDetailFetch(retryFailed = false) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can do this." };
  const r = startDetailFetch({ retryFailed: retryFailed === true });
  if (!r.started) return { success: false as const, error: r.reason ?? "Could not start" };
  revalidatePath("/customers/mybillbook-import");
  return { success: true as const };
}

/** Super Admin only: pause the background read (progress is saved; Start continues where it stopped). */
export async function stopMybillbookDetailFetch() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can do this." };
  stopDetailFetch();
  return { success: true as const };
}

/** Super Admin only: turn an uploaded Excel workbook (.xlsx / .xls, first sheet) into the same CSV text the importer reads. */
export async function convertMybillbookWorkbook(base64: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can import MyBillBook history." };
  if (typeof base64 !== "string" || base64.length > MAX_CSV_BYTES * 2) return { success: false as const, error: "The file is too large (5 MB maximum)." };
  try {
    // Cells are read raw: an Excel date arrives as its serial number (the importer converts it), never as the "10/21/26" text a US-style
    // cell format would print — that text could silently swap day and month. The first sheet that has the report header is used.
    const wb = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
    if (!wb.SheetNames.length) return { success: false as const, error: "The workbook has no sheet." };
    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, blankrows: false, defval: "" });
      const csv = Papa.unparse(grid.map((r) => r.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))) as unknown[][]);
      if (/^invoice (no|number)\b/im.test(csv)) return { success: true as const, csv };
    }
    return { success: false as const, error: "No sheet in this workbook has an “Invoice No” header row." };
  } catch {
    return { success: false as const, error: "That file could not be read as an Excel workbook." };
  }
}

/** Super Admin only: what an upload contains and what importing it would do — writes nothing. */
export async function previewMybillbookReport(csvText: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can import MyBillBook history." };
  if (typeof csvText !== "string" || !csvText.trim()) return { success: false as const, error: "The file is empty." };
  if (csvText.length > MAX_CSV_BYTES) return { success: false as const, error: "The file is too large (5 MB maximum)." };
  return { success: true as const, preview: await previewMybillbookCsv(csvText) };
}

/** Super Admin only: create CRM profiles for MyBillBook customers that only exist in the invoice history (needs the mobile read from the invoice). */
export async function createMybillbookCustomers(apply: boolean) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false as const, error: "Only the Super Admin can do this." };
  const r = await createCustomersFromUnattached({ dryRun: apply !== true });
  if (apply === true) {
    await db.auditLog.create({ data: { entityType: "MybillbookImport", entityId: "create-customers", action: "CREATE_CUSTOMERS", summary: `MyBillBook: ${r.created} customer profile(s) created, ${r.attachedToExisting} existing matched, ${r.invoicesAttached} invoice(s) attached, ${r.noMobile} left without a mobile`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
    revalidatePath("/customers/mybillbook-import");
    revalidatePath("/customers");
  }
  return { success: true as const, result: r };
}
