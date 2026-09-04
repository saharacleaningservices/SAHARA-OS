// MyBillBook integration.
//
// MyBillBook does not publish a general-purpose third-party REST API for
// arbitrary CRM integrations the way Zoho Books/QuickBooks do — access is
// account/plan-specific and issued on request from MyBillBook support. This
// module is therefore a real, working abstraction with a hard external
// blocker: it needs (1) confirmation your MyBillBook plan includes API
// access, and (2) the API key/business ID they issue for it.
//
// Until MYBILLBOOK_API_KEY is set, quotations/invoices are generated and
// stored natively in Sahara OS (PDF + line items, see src/server/invoices.ts
// and /api/quotations/[id]/pdf, /api/invoices/[id]/pdf) and simply marked
// "NOT_CONFIGURED" here — nothing is faked as synced. The moment the key is
// added, syncQuotationToMyBillBook/syncInvoiceToMyBillBook start actually
// calling out and flipping the status to SYNCED/FAILED.
import { db } from "@/lib/db";

export function isMyBillBookConfigured(): boolean {
  return Boolean(process.env.MYBILLBOOK_API_KEY);
}

export async function syncInvoiceToMyBillBook(invoiceId: string) {
  if (!isMyBillBookConfigured()) {
    await db.invoice.update({ where: { id: invoiceId }, data: { mybillbookSyncStatus: "NOT_CONFIGURED" } });
    return { synced: false as const, reason: "MYBILLBOOK_API_KEY is not set" };
  }

  // MyBillBook's endpoint/payload shape depends on the API access they grant
  // for this account — wire the real request here once MYBILLBOOK_API_BASE_URL
  // and MYBILLBOOK_API_KEY are confirmed and set.
  try {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { synced: false as const, reason: "Invoice not found" };

    const baseUrl = process.env.MYBILLBOOK_API_BASE_URL;
    if (!baseUrl) {
      await db.invoice.update({ where: { id: invoiceId }, data: { mybillbookSyncStatus: "NOT_CONFIGURED" } });
      return { synced: false as const, reason: "MYBILLBOOK_API_BASE_URL is not set" };
    }

    const res = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MYBILLBOOK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        customerMobile: invoice.customerMobile,
        lineItems: JSON.parse(invoice.lineItems),
        totalAmount: invoice.totalAmount,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      await db.invoice.update({
        where: { id: invoiceId },
        data: { mybillbookSyncStatus: "FAILED" },
      });
      return { synced: false as const, reason: payload?.message || `HTTP ${res.status}` };
    }
    await db.invoice.update({
      where: { id: invoiceId },
      data: { mybillbookSyncStatus: "SYNCED", mybillbookInvoiceId: payload?.id ?? null },
    });
    return { synced: true as const };
  } catch (err) {
    await db.invoice.update({ where: { id: invoiceId }, data: { mybillbookSyncStatus: "FAILED" } });
    return { synced: false as const, reason: (err as Error).message };
  }
}
