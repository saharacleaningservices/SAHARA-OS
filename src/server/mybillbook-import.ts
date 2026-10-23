// Imports MyBillBook invoice history and attaches it to CRM customers — only on a safe match. Not a "use server" module (nothing here is
// callable from the browser); the Admin-only entry points are in src/server/actions/mybillbook-import.ts.
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { SERVICE_LABELS } from "@/lib/constants";
import { indexCustomersByName, matchByName, parseSalesSummaryCsv, type ParsedInvoice } from "@/lib/mybillbook-import";
import { normalizeMobile } from "@/server/customer-db";

export type ImportSummary = {
  rowsInFile: number;
  created: number;
  updated: number;
  unchanged: number;
  matched: number;
  needsReview: number;
  unmatched: number;
  skipped: { line: number; reason: string }[];
};

const same = (a: ParsedInvoice, r: { invoiceDate: Date; contactName: string; amount: number; remaining: number; status: string; invoiceLink: string; paymentType: string | null; createdByName: string | null }) =>
  a.invoiceDate.getTime() === r.invoiceDate.getTime() && a.contactName === r.contactName && a.amount === r.amount && a.remaining === r.remaining && a.status === r.status && a.invoiceLink === r.invoiceLink && a.paymentType === r.paymentType && a.createdByName === r.createdByName;

/**
 * Re-runnable: an invoice number already stored is UPDATED in place (amount / balance / status / link follow MyBillBook), never added a
 * second time. A customer link that was already made (automatically or by an admin) is never moved by a re-import; rows still waiting
 * for a match are matched again, because new customers may have been added since.
 */
export async function importMybillbookCsv(text: string, batchId: string): Promise<ImportSummary> {
  const { rows, skipped } = parseSalesSummaryCsv(text);
  const summary: ImportSummary = { rowsInFile: rows.length, created: 0, updated: 0, unchanged: 0, matched: 0, needsReview: 0, unmatched: 0, skipped };
  if (!rows.length) return summary;

  const customers = await db.customer.findMany({ select: { id: true, name: true } });
  const byName = indexCustomersByName(customers);

  // Strongest signal first: the CRM already records MyBillBook invoice numbers on payments → the job → the customer.
  // Only for an invoice number that is unique in the file: a reused number cannot say which of the invoices the CRM payment means.
  const numberCount = new Map<string, number>();
  for (const r of rows) numberCount.set(r.invoiceNo, (numberCount.get(r.invoiceNo) ?? 0) + 1);
  const payments = await db.payment.findMany({ where: { mybillbookInvoiceNo: { in: rows.map((r) => r.invoiceNo) }, deletedAt: null }, select: { mybillbookInvoiceNo: true, jobId: true } });
  const jobIdByInvoice = new Map(payments.filter((p) => p.mybillbookInvoiceNo && p.jobId && numberCount.get(p.mybillbookInvoiceNo) === 1).map((p) => [p.mybillbookInvoiceNo as string, p.jobId as string]));
  const jobs = jobIdByInvoice.size ? await db.job.findMany({ where: { id: { in: [...new Set(jobIdByInvoice.values())] } }, select: { id: true, customerMobile: true, service: true } }) : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const customerByMobile = new Map((await db.customer.findMany({ select: { id: true, mobile: true } })).map((c) => [normalizeMobile(c.mobile), c.id]));

  const existing = new Map((await db.mybillbookInvoice.findMany({ where: { invoiceKey: { in: rows.map((r) => r.invoiceKey) } } })).map((e) => [e.invoiceKey, e]));

  // Database work is done in batches with a pause between them: thousands of one-by-one writes would otherwise keep the whole server
  // busy for many seconds (the same problem as the backup freeze).
  const toCreate: Prisma.MybillbookInvoiceCreateManyInput[] = [];
  const breathe = () => new Promise<void>((resolve) => setImmediate(resolve));
  let sinceBreath = 0;

  for (const r of rows) {
    const old = existing.get(r.invoiceKey);
    const data = { invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate, contactName: r.contactName, amount: r.amount, remaining: r.remaining, status: r.status, invoiceLink: r.invoiceLink, paymentType: r.paymentType, createdByName: r.createdByName };

    const alreadyLinked = !!old && !!old.customerId && (old.matchStatus === "MATCHED" || old.matchStatus === "MANUAL");
    let link: { customerId: string | null; matchStatus: string; matchMethod: string | null; candidateIds: string | null; jobId: string | null; serviceName: string | null };
    if (alreadyLinked) {
      link = { customerId: old!.customerId, matchStatus: old!.matchStatus, matchMethod: old!.matchMethod, candidateIds: null, jobId: old!.jobId, serviceName: old!.serviceName };
    } else {
      const jobId = jobIdByInvoice.get(r.invoiceNo) ?? null;
      const job = jobId ? jobById.get(jobId) : undefined;
      const viaJob = job ? customerByMobile.get(normalizeMobile(job.customerMobile)) : undefined;
      if (job && viaJob) {
        link = { customerId: viaJob, matchStatus: "MATCHED", matchMethod: "INVOICE_NO", candidateIds: null, jobId: job.id, serviceName: SERVICE_LABELS[job.service] ?? job.service };
      } else {
        const m = matchByName(r.contactName, byName);
        link =
          m.status === "MATCHED"
            ? { customerId: m.customerId, matchStatus: "MATCHED", matchMethod: "NAME", candidateIds: null, jobId: null, serviceName: old?.serviceName ?? null }
            : m.status === "REVIEW"
              ? { customerId: null, matchStatus: "REVIEW", matchMethod: null, candidateIds: JSON.stringify(m.candidateIds), jobId: null, serviceName: old?.serviceName ?? null }
              : { customerId: null, matchStatus: "UNMATCHED", matchMethod: null, candidateIds: null, jobId: null, serviceName: old?.serviceName ?? null };
      }
    }
    if (link.matchStatus === "MATCHED" || link.matchStatus === "MANUAL") summary.matched += 1;
    else if (link.matchStatus === "REVIEW") summary.needsReview += 1;
    else summary.unmatched += 1;

    if (!old) {
      toCreate.push({ invoiceKey: r.invoiceKey, ...data, ...link, importBatchId: batchId });
      summary.created += 1;
    } else {
      const linkChanged = old.customerId !== link.customerId || old.matchStatus !== link.matchStatus || (old.candidateIds ?? null) !== link.candidateIds || old.jobId !== link.jobId;
      if (same(r, old) && !linkChanged) {
        summary.unchanged += 1;
      } else {
        await db.mybillbookInvoice.update({ where: { invoiceKey: r.invoiceKey }, data: { ...data, ...link, importBatchId: batchId } });
        summary.updated += 1;
        if (++sinceBreath % 40 === 0) await breathe();
      }
    }
  }
  for (let i = 0; i < toCreate.length; i += 150) {
    await db.mybillbookInvoice.createMany({ data: toCreate.slice(i, i + 150) });
    await breathe();
  }
  return summary;
}

/** An admin picks the customer for a row that is waiting on the review list (by customer id or by the customer's mobile number). */
export async function assignInvoiceToCustomer(invoiceKey: string, target: { customerId?: string; mobile?: string }) {
  const row = await db.mybillbookInvoice.findUnique({ where: { invoiceKey }, select: { id: true } });
  if (!row) return { ok: false as const, error: "Invoice not found" };
  const mobile = target.mobile ? normalizeMobile(target.mobile) : null;
  const customer = target.customerId
    ? await db.customer.findUnique({ where: { id: target.customerId }, select: { id: true, name: true } })
    : mobile
      ? await db.customer.findUnique({ where: { mobile }, select: { id: true, name: true } })
      : null;
  if (!customer) return { ok: false as const, error: target.mobile ? "No customer with that mobile number" : "Customer not found" };
  await db.mybillbookInvoice.update({ where: { invoiceKey }, data: { customerId: customer.id, matchStatus: "MANUAL", matchMethod: "MANUAL", candidateIds: null } });
  return { ok: true as const, customerName: customer.name };
}

/** Takes an invoice back off a customer (wrong match) — it returns to the review list. */
export async function detachInvoice(invoiceKey: string) {
  const row = await db.mybillbookInvoice.findUnique({ where: { invoiceKey }, select: { id: true } });
  if (!row) return { ok: false as const, error: "Invoice not found" };
  await db.mybillbookInvoice.update({ where: { invoiceKey }, data: { customerId: null, matchStatus: "UNMATCHED", matchMethod: null, candidateIds: null, jobId: null } });
  return { ok: true as const };
}
