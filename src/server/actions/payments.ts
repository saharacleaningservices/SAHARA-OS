"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentSchema } from "@/lib/validation";
import { generateInvoiceNumber } from "@/lib/id-generators";
import { addPaymentTimeline } from "@/server/timeline";
import { softDeleteMany } from "@/server/audit";
import { notify } from "@/server/notify";

/**
 * None of these actions had ANY role check at all before the 2026-09-21
 * Francis policy audit — only page-level nav access (middleware +
 * ROLE_NAV_ACCESS) gated the Payments module, which stops a restricted
 * role from ever seeing the page but doesn't stop a direct Server Action
 * call. Matches who actually has "payments" in ROLE_NAV_ACCESS
 * (src/lib/constants.ts): ADMIN, ACCOUNTS, OPERATIONS. SUPERVISOR
 * (Francis) and STAFF are excluded — same as everyone without page access.
 */
function canAccessPayments(role: string | undefined): boolean {
  return role === "ADMIN" || role === "ACCOUNTS"; // owner rule 2026-10-08: not Operations
}

export async function createPayment(values: unknown) {
  const session = await getSession();
  if (!canAccessPayments(session?.role)) return { error: "Not authorized", success: false as const };
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const invoiceNumber = await generateInvoiceNumber();

  await db.payment.create({
    data: {
      invoiceNumber,
      clientName: data.clientName,
      clientMobile: data.clientMobile || null,
      amount: data.amount,
      dueDate: new Date(data.dueDate),
      jobId: data.jobId || null,
      mybillbookInvoiceNo: data.mybillbookInvoiceNo || null,
      invoiceAttachmentUrl: data.invoiceAttachmentUrl || null,
      notes: data.notes || null,
      recordedById: session?.sub,
    },
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function updatePayment(id: string, values: unknown) {
  const session = await getSession();
  if (!canAccessPayments(session?.role)) return { error: "Not authorized", success: false as const };
  const parsed = paymentSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const d = parsed.data;
  await db.payment.update({
    where: { id },
    data: {
      ...(d.clientName && { clientName: d.clientName }),
      ...(d.clientMobile !== undefined && { clientMobile: d.clientMobile || null }),
      ...(d.amount !== undefined && { amount: d.amount }),
      ...(d.dueDate && { dueDate: new Date(d.dueDate) }),
      ...(d.mybillbookInvoiceNo !== undefined && {
        mybillbookInvoiceNo: d.mybillbookInvoiceNo || null,
      }),
      ...(d.invoiceAttachmentUrl !== undefined && {
        invoiceAttachmentUrl: d.invoiceAttachmentUrl || null,
      }),
      ...(d.notes !== undefined && { notes: d.notes || null }),
    },
  });
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  return { success: true as const };
}

export async function deletePayment(id: string) {
  const session = await getSession();
  if (!session || !canAccessPayments(session.role)) return { error: "Not authorized" };
  await softDeleteMany("Payment", [id], session);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  return { success: true };
}

export async function bulkDeletePayments(ids: string[]) {
  const session = await getSession();
  if (!session || !canAccessPayments(session.role)) return { error: "Not authorized" };
  const count = await softDeleteMany("Payment", ids, session);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  return { success: true as const, count };
}

export async function markPaymentPaid(paymentId: string) {
  const session = await getSession();
  if (!canAccessPayments(session?.role)) return { error: "Not authorized", success: false as const };
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found", success: false as const };

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAmount: payment.amount, paidDate: new Date() },
  });

  await addPaymentTimeline(
    payment.leadId,
    `Payment received — ₹${payment.amount.toLocaleString("en-IN")} against invoice ${payment.invoiceNumber}`,
    { invoiceNumber: payment.invoiceNumber, amount: payment.amount }
  );

  await notify({
    kind: "PAYMENT_RECEIVED",
    title: `Payment received — ₹${payment.amount.toLocaleString("en-IN")}`,
    body: `${payment.clientName} · invoice ${payment.invoiceNumber}`,
    href: "/payments",
    whatsappToAdmin: true,
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  revalidatePath("/leads");
  return { success: true as const };
}

/**
 * Record a collection against a payment — a cash collection, a UPI/bank
 * transfer, or "collect the full balance". Increments paidAmount and flips
 * the row to PAID once fully covered.
 */
export async function recordCollection(
  paymentId: string,
  input: { amount?: number; mode?: "UPI" | "QR" | "BANK" | "CASH"; full?: boolean },
) {
  const session = await getSession();
  if (!canAccessPayments(session?.role)) return { error: "Not authorized", success: false as const };
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found", success: false as const };

  const outstanding = Math.max(payment.amount - payment.paidAmount, 0);
  const amount = input.full ? outstanding : Math.min(Math.max(input.amount ?? 0, 0), outstanding);
  if (amount <= 0) return { error: "Enter an amount to collect", success: false as const };

  const paidAmount = payment.paidAmount + amount;
  const fullyPaid = paidAmount >= payment.amount - 0.01;

  await db.payment.update({
    where: { id: paymentId },
    data: {
      paidAmount,
      status: fullyPaid ? "PAID" : payment.status,
      paidDate: fullyPaid ? new Date() : payment.paidDate ?? new Date(),
      mode: input.mode ?? payment.mode,
      recordedById: session?.sub ?? payment.recordedById,
    },
  });

  await addPaymentTimeline(
    payment.leadId,
    `Collected ₹${amount.toLocaleString("en-IN")}${input.mode ? ` (${input.mode})` : ""} against ${payment.invoiceNumber}${
      fullyPaid ? " — fully paid" : ""
    }`,
    { invoiceNumber: payment.invoiceNumber, amount },
  ).catch(() => {});

  await notify({
    kind: "PAYMENT_RECEIVED",
    title: `Payment collected — ₹${amount.toLocaleString("en-IN")}`,
    body: `${payment.clientName}${input.mode ? ` · ${input.mode}` : ""} · ${payment.invoiceNumber}`,
    href: "/payments",
    whatsappToAdmin: true,
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  revalidatePath("/revenue");
  revalidatePath("/leads");
  return { success: true as const, collected: amount, fullyPaid };
}

export async function recordReminder(paymentId: string, channel: "WHATSAPP" | "EMAIL" | "CALL") {
  const session = await getSession();
  if (!canAccessPayments(session?.role)) return { error: "Not authorized", success: false as const };
  await db.payment.update({
    where: { id: paymentId },
    data: { lastReminderAt: new Date(), lastReminderChannel: channel },
  });
  revalidatePath("/payments");
  return { success: true as const };
}
