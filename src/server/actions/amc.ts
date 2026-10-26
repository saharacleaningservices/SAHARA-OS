"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { amcSchema } from "@/lib/validation";
import { generateAmcNumber } from "@/lib/id-generators";
import { AMC_FREQUENCY_DAYS } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { amcRenewalMessage } from "@/lib/whatsapp-templates";
import { canManageAmc } from "@/lib/permissions";

export async function createAmc(values: unknown) {
  const session = await getSession();
  if (!canManageAmc(session?.role ?? "")) return { error: "Not authorized", success: false as const };
  const parsed = amcSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  const d = parsed.data;

  const startDate = new Date(d.startDate);
  const nextVisitDate = new Date(startDate);
  nextVisitDate.setDate(nextVisitDate.getDate() + (AMC_FREQUENCY_DAYS[d.frequency] ?? 90));

  // One-year contract term by default when no explicit expiry is given.
  const defaultExpiry = new Date(startDate);
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

  const contractNumber = await generateAmcNumber();
  const amc = await db.amcContract.create({
    data: {
      contractNumber,
      customerName: d.customerName,
      customerMobile: d.customerMobile,
      address: d.address || null,
      area: d.area || null,
      category: d.category,
      frequency: d.frequency,
      serviceCategory: (d.serviceCategory || null) as never,
      amount: d.amount,
      startDate,
      nextVisitDate,
      serviceReminderDate: d.serviceReminderDate ? new Date(d.serviceReminderDate) : nextVisitDate,
      contractExpiryDate: d.contractExpiryDate ? new Date(d.contractExpiryDate) : defaultExpiry,
      notes: d.notes || null,
      leadId: d.leadId || null,
    },
  });

  revalidatePath("/amc");
  return { success: true as const, id: amc.id };
}

export async function recordAmcVisit(amcId: string, visitDate: string, notes: string) {
  const session = await getSession();
  if (!session || !canManageAmc(session.role)) return { error: "Not authorized" };

  const amc = await db.amcContract.findUnique({ where: { id: amcId } });
  if (!amc) return { error: "AMC contract not found" };

  await db.amcVisit.create({ data: { amcId, visitDate: new Date(visitDate), notes: notes || null } });

  const nextVisitDate = new Date(visitDate);
  nextVisitDate.setDate(nextVisitDate.getDate() + (AMC_FREQUENCY_DAYS[amc.frequency] ?? 90));

  await db.amcContract.update({
    where: { id: amcId },
    data: { lastVisitDate: new Date(visitDate), nextVisitDate },
  });

  revalidatePath("/amc");
  revalidatePath(`/amc/${amcId}`);
  return { success: true as const };
}

export async function cancelAmc(amcId: string) {
  const session = await getSession();
  if (!session || !canManageAmc(session.role)) return { error: "Not authorized" };
  await db.amcContract.update({ where: { id: amcId }, data: { status: "CANCELLED" } });
  revalidatePath("/amc");
  return { success: true as const };
}

export async function deleteAmc(id: string) {
  const session = await getSession();
  if (!session || !canManageAmc(session.role)) return { error: "Not authorized" };
  await db.amcContract.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: session.name } });
  await db.auditLog.create({
    data: {
      entityType: "AmcContract",
      entityId: id,
      action: "DELETE",
      summary: "Deleted 1 AMC contract",
      actorName: session.name,
      actorEmail: session.email,
    },
  });
  revalidatePath("/amc");
  return { success: true as const };
}

export async function sendAmcRenewalNow(amcId: string) {
  const session = await getSession();
  if (!session || !canManageAmc(session.role)) return { success: false as const, error: "Not authorized" };
  const amc = await db.amcContract.findUnique({ where: { id: amcId } });
  if (!amc) return { success: false as const, error: "AMC contract not found" };

  const res = await sendWhatsApp({
    kind: "AMC_RENEWAL",
    toNumber: amc.customerMobile,
    toName: amc.customerName,
    body: amcRenewalMessage({ customerName: amc.customerName, nextVisitDate: amc.nextVisitDate, frequency: amc.frequency }),
    relatedType: "AmcContract",
    relatedId: amc.id,
  });
  return { success: true as const, sent: res.sent, queued: res.queued, error: undefined as string | undefined };
}
