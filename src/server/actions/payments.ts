"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentSchema } from "@/lib/validation";
import { generateInvoiceNumber } from "@/lib/id-generators";

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
      notes: data.notes || null,
      recordedById: session?.sub,
    },
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markPaymentPaid(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found", success: false as const };

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAmount: payment.amount, paidDate: new Date() },
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/profit");
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
