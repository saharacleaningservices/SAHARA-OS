"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { leadSchema } from "@/lib/validation";
import { generateLeadNumber, generateQuoteNumber } from "@/lib/id-generators";
import { QUOTATION_TERMS } from "@/lib/constants";

export async function createLead(values: unknown) {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const session = await getSession();
  const data = parsed.data;

  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: data.name,
      mobile: data.mobile,
      whatsapp: data.whatsapp || data.mobile,
      address: data.address || null,
      area: data.area,
      service: data.service,
      source: data.source,
      quoteAmount: data.quoteAmount ?? null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      assignedStaffId: data.assignedStaffId || null,
      notes: data.notes || null,
      createdById: session?.sub,
      assignedToId: data.assignedToId || session?.sub,
    },
  });

  await db.activityLog.create({
    data: { leadId: lead.id, actorId: session?.sub, action: `Lead created (${data.source})` },
  });

  if (data.followUpDate) {
    await db.followUp.create({
      data: {
        leadId: lead.id,
        dueDate: new Date(data.followUpDate),
        type: "CALL",
        notes: "Initial follow-up",
        assignedToId: session?.sub,
      },
    });
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, leadId: lead.id };
}

export async function updateLead(id: string, values: unknown) {
  const parsed = leadSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const data = parsed.data;
  await db.lead.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.mobile && { mobile: data.mobile }),
      ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.area && { area: data.area }),
      ...(data.service && { service: data.service }),
      ...(data.source && { source: data.source }),
      ...(data.quoteAmount !== undefined && { quoteAmount: data.quoteAmount }),
      ...(data.followUpDate !== undefined && {
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      }),
      ...(data.assignedStaffId !== undefined && { assignedStaffId: data.assignedStaffId || null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { success: true, leadId: id };
}

type LeadStage =
  | "NEW"
  | "SITE_VISIT"
  | "QUOTE_SENT"
  | "NEGOTIATION"
  | "CONFIRMED"
  | "JOB_SCHEDULED"
  | "COMPLETED"
  | "PAID";

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  if (!leadId) return { error: "Missing lead", success: false as const };
  const session = await getSession();
  await db.lead.update({ where: { id: leadId }, data: { stage } });
  await db.activityLog.create({
    data: { leadId, actorId: session?.sub, action: `Stage moved to ${stage.replaceAll("_", " ")}` },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function scheduleVisit(leadId: string, date: string) {
  if (!date) return { error: "Pick a date", success: false as const };
  const session = await getSession();
  await db.lead.update({
    where: { id: leadId },
    data: { followUpDate: new Date(date), stage: "SITE_VISIT" },
  });
  await db.followUp.create({
    data: {
      leadId,
      dueDate: new Date(date),
      type: "VISIT",
      notes: "Site visit scheduled",
      assignedToId: session?.sub,
    },
  });
  await db.activityLog.create({
    data: { leadId, actorId: session?.sub, action: `Site visit scheduled` },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addFollowUp(leadId: string, dueDate: string, type: string, notes: string) {
  const session = await getSession();
  await db.followUp.create({
    data: {
      leadId,
      dueDate: new Date(dueDate),
      type: type as "CALL" | "WHATSAPP" | "VISIT" | "EMAIL",
      notes: notes || null,
      assignedToId: session?.sub,
    },
  });
  await db.lead.update({ where: { id: leadId }, data: { followUpDate: new Date(dueDate) } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleFollowUpDone(followUpId: string, leadId: string) {
  const followUp = await db.followUp.findUnique({ where: { id: followUpId } });
  if (!followUp) return { error: "Not found" };
  await db.followUp.update({
    where: { id: followUpId },
    data: { isDone: !followUp.isDone, doneAt: !followUp.isDone ? new Date() : null },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createQuotation(
  leadId: string,
  services: { name: string; description: string; amount: number }[],
  gstPercent: number
) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found" };

  const subTotal = services.reduce((sum, s) => sum + s.amount, 0);
  const gstAmount = Math.round((subTotal * gstPercent) / 100);
  const totalAmount = subTotal + gstAmount;

  const quoteNumber = await generateQuoteNumber();
  const quotation = await db.quotation.create({
    data: {
      quoteNumber,
      leadId,
      services: JSON.stringify(services),
      subTotal,
      gstPercent,
      gstAmount,
      totalAmount,
      terms: QUOTATION_TERMS,
      validTill: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  if (lead.stage === "NEW" || lead.stage === "SITE_VISIT") {
    await db.lead.update({ where: { id: leadId }, data: { stage: "QUOTE_SENT", quoteAmount: totalAmount } });
  }

  const session = await getSession();
  await db.activityLog.create({
    data: { leadId, actorId: session?.sub, action: `Quotation ${quoteNumber} generated (${totalAmount})` },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: true, quotationId: quotation.id };
}
