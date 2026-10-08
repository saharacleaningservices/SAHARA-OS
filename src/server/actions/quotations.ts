"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateStandaloneInvoiceNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";

// Quotations / invoices carry customer contact + amounts — Super Admin + Accounts (owner rule 2026-10-08).
const BILLING_ROLES = ["ADMIN", "ACCOUNTS"];

async function requireBillingAccess() {
  const session = await getSession();
  if (!session) return { error: "Not authorized" as const, session: null };
  if (!BILLING_ROLES.includes(session.role)) {
    return { error: "You don't have access to quotations/invoices" as const, session: null };
  }
  return { error: null, session };
}

const QUOTATION_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const;
const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;

export async function updateQuotationStatus(quotationId: string, status: (typeof QUOTATION_STATUSES)[number]) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const { error, session } = await requireBillingAccess();
  if (error) return { error };
  if (!QUOTATION_STATUSES.includes(status)) return { error: "Invalid status" };

  const quotation = await db.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) return { error: "Quotation not found" };

  await db.quotation.update({ where: { id: quotationId }, data: { status } });
  await addTimelineEntry({
    leadId: quotation.leadId,
    type: "QUOTATION",
    body: `Quotation ${quotation.quoteNumber} marked ${status}`,
    authorId: session?.sub,
  }).catch(() => {});

  revalidatePath("/quotations");
  revalidatePath(`/leads/${quotation.leadId}`);
  return { success: true as const };
}

/** Converts an accepted Quotation directly into a Sahara-native Invoice, carrying over its line items/GST/discount/terms. */
export async function convertQuotationToInvoice(quotationId: string) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const { error, session } = await requireBillingAccess();
  if (error) return { error };

  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    include: { lead: true, invoice: true },
  });
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.invoice) return { error: "This quotation already has an invoice" };

  const invoiceNumber = await generateStandaloneInvoiceNumber();
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      quotationId: quotation.id,
      customerName: quotation.lead.name,
      customerMobile: quotation.lead.mobile,
      customerAddress: quotation.lead.address,
      lineItems: quotation.services,
      subTotal: quotation.subTotal,
      discount: quotation.discount,
      gstPercent: quotation.gstPercent,
      gstAmount: quotation.gstAmount,
      totalAmount: quotation.totalAmount,
      terms: quotation.terms,
      status: "ISSUED",
    },
  });
  await db.quotation.update({ where: { id: quotationId }, data: { status: "ACCEPTED" } });
  await addTimelineEntry({
    leadId: quotation.leadId,
    type: "PAYMENT",
    body: `Invoice ${invoiceNumber} created from Quotation ${quotation.quoteNumber}`,
    meta: { invoiceId: invoice.id, invoiceNumber },
    authorId: session?.sub,
  }).catch(() => {});

  revalidatePath("/quotations");
  revalidatePath("/invoices");
  revalidatePath(`/leads/${quotation.leadId}`);
  return { success: true as const, invoiceId: invoice.id };
}

export async function updateInvoiceStatus(invoiceId: string, status: (typeof INVOICE_STATUSES)[number]) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const { error } = await requireBillingAccess();
  if (error) return { error };
  if (!INVOICE_STATUSES.includes(status)) return { error: "Invalid status" };

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: "Invoice not found" };

  await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  revalidatePath("/invoices");
  return { success: true as const };
}

const emptyLineItems = "[]";

/** Manual, ad-hoc invoice creation — not tied to a Job or Quotation (e.g. a walk-in customer). */
export async function createInvoice(data: {
  customerName: string;
  customerMobile?: string;
  customerAddress?: string;
  lineItems: { name: string; description: string; amount: number }[];
  discount?: number;
  gstPercent?: number;
  notes?: string;
  terms?: string;
}) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const { error } = await requireBillingAccess();
  if (error) return { error };
  if (!data.customerName.trim()) return { error: "Customer name is required" };
  if (!data.lineItems.length) return { error: "Add at least one line item" };

  const subTotal = data.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const discount = data.discount ?? 0;
  const gstPercent = data.gstPercent ?? 0;
  const taxable = Math.max(subTotal - discount, 0);
  const gstAmount = Math.round((taxable * gstPercent) / 100);
  const totalAmount = taxable + gstAmount;

  const invoiceNumber = await generateStandaloneInvoiceNumber();
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      customerName: data.customerName.trim(),
      customerMobile: data.customerMobile || null,
      customerAddress: data.customerAddress || null,
      lineItems: JSON.stringify(data.lineItems) || emptyLineItems,
      subTotal,
      discount,
      gstPercent,
      gstAmount,
      totalAmount,
      notes: data.notes || null,
      terms: data.terms || null,
      status: "ISSUED",
    },
  });

  revalidatePath("/invoices");
  return { success: true as const, invoiceId: invoice.id };
}

/**
 * Customer booking link for a quotation: /booking?quote=<unguessable token>.
 * The customer then only picks date, slot and payment preference.
 */
export async function getQuotationBookingLink(quotationId: string) {
  const { error } = await requireBillingAccess();
  if (error) return { error };
  const q = await db.quotation.findUnique({ where: { id: quotationId }, select: { publicToken: true } });
  if (!q) return { error: "Quotation not found" };
  let token = q.publicToken;
  if (!token) {
    const { randomBytes } = await import("node:crypto");
    token = randomBytes(18).toString("base64url");
    await db.quotation.update({ where: { id: quotationId }, data: { publicToken: token } });
  }
  const { PUBLIC_BOOKING_URL } = await import("@/lib/site-urls");
  return { success: true as const, url: `${PUBLIC_BOOKING_URL}/booking?quote=${token}` };
}
