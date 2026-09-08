"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentSchema } from "@/lib/validation";
import { generateInvoiceNumber } from "@/lib/id-generators";
import { addPaymentTimeline } from "@/server/timeline";
import { softDeleteMany } from "@/server/audit";
import { notify } from "@/server/notify";

export async function createPayment(values: unknown) {
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();
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
  if (!session) return { error: "Not authorized" };
  await softDeleteMany("Payment", [id], session);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  return { success: true };
}

export async function bulkDeletePayments(ids: string[]) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const count = await softDeleteMany("Payment", ids, session);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
  return { success: true as const, count };
}

export async function markPaymentPaid(paymentId: string) {
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

export async function recordReminder(paymentId: string, channel: "WHATSAPP" | "EMAIL" | "CALL") {
  await db.payment.update({
    where: { id: paymentId },
    data: { lastReminderAt: new Date(), lastReminderChannel: channel },
  });
  revalidatePath("/payments");
  return { success: true as const };
}
