"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  leadSchema,
  quickCaptureSchema,
  followUpSchema,
  confirmBookingSchema,
  callLogSchema,
  timelineNoteSchema,
} from "@/lib/validation";
import { generateLeadNumber, generateQuoteNumber, generateJobNumber } from "@/lib/id-generators";
import {
  QUOTATION_TERMS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  FOLLOWUP_TYPE_LABELS,
  CALL_OUTCOME_LABELS,
  COMPANY,
} from "@/lib/constants";
import { addTimelineEntry } from "@/server/timeline";

const MIN_JOB_VALUE = COMPANY.minimumJobValue;

function combineDateTime(date: string, time?: string) {
  return time ? new Date(`${date}T${time}`) : new Date(date);
}

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

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: `Enquiry captured — source: ${data.source}`,
    authorId: session?.sub,
  });
  if (data.notes) {
    await addTimelineEntry({ leadId: lead.id, type: "NOTE", body: data.notes, authorId: session?.sub });
  }

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

/** AI Quick Capture — mobile + name + area + service, everything else later. */
export async function quickCaptureLead(values: unknown) {
  const parsed = quickCaptureSchema.safeParse(values);
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
      whatsapp: data.mobile,
      area: data.area,
      service: data.service,
      source: "CALL",
      createdById: session?.sub,
      assignedToId: session?.sub,
    },
  });

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: "Enquiry quick-captured — complete the details when you have them.",
    authorId: session?.sub,
  });

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

export async function deleteLead(id: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  await db.job.updateMany({ where: { leadId: id }, data: { leadId: null } });
  await db.payment.updateMany({ where: { leadId: id }, data: { leadId: null } });
  // Cascades quotations, follow-ups, activity logs and timeline entries.
  await db.lead.delete({ where: { id } });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true };
}

type LeadStage = (typeof LEAD_STAGES)[number];

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  if (!leadId) return { error: "Missing lead", success: false as const };
  if (!LEAD_STAGES.includes(stage)) return { error: "Unknown stage", success: false as const };
  if (stage === "CONFIRMED") {
    return {
      error: "Use the Confirm Booking action so a service date and slot are set.",
      success: false as const,
    };
  }

  const session = await getSession();
  const current = await db.lead.findUnique({ where: { id: leadId }, select: { stage: true } });
  await db.lead.update({ where: { id: leadId }, data: { stage } });
  await addTimelineEntry({
    leadId,
    type: "STAGE",
    body: `Stage → ${LEAD_STAGE_LABELS[stage]}`,
    meta: { fromStage: current?.stage, toStage: stage },
    authorId: session?.sub,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/** Confirm a booking: capture service date + slot and auto-create the job. */
export async function confirmBooking(leadId: string, values: unknown) {
  const parsed = confirmBookingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found", success: false as const };

  const existingJob = await db.job.findFirst({ where: { leadId } });
  if (existingJob) {
    return { error: "This enquiry already has a job.", success: false as const };
  }

  const scheduledDate = new Date(data.serviceDate);
  const jobValue =
    lead.quoteAmount && lead.quoteAmount >= MIN_JOB_VALUE ? lead.quoteAmount : MIN_JOB_VALUE;

  const jobNumber = await generateJobNumber();
  const job = await db.job.create({
    data: {
      jobNumber,
      leadId,
      customerName: lead.name,
      customerMobile: lead.mobile,
      address: lead.address || lead.area,
      area: lead.area,
      service: lead.service,
      scheduledDate,
      scheduledTime: data.timeSlot,
      supervisorId: data.supervisorId || null,
      jobValue,
      notes: `Auto-created from enquiry ${lead.leadNumber}`,
    },
  });

  if (lead.assignedStaffId) {
    await db.jobAssignment.create({
      data: { jobId: job.id, staffId: lead.assignedStaffId, isLead: true },
    });
  }

  await db.lead.update({
    where: { id: leadId },
    data: { stage: "JOB_SCHEDULED", followUpDate: scheduledDate },
  });

  await addTimelineEntry({
    leadId,
    type: "STAGE",
    body: "Booking confirmed",
    meta: { fromStage: lead.stage, toStage: "JOB_SCHEDULED" },
    authorId: session?.sub,
  });
  await addTimelineEntry({
    leadId,
    type: "JOB",
    body: `Job ${jobNumber} scheduled — ${data.serviceDate} at ${data.timeSlot}`,
    meta: { jobId: job.id, jobNumber, date: data.serviceDate, slot: data.timeSlot },
    authorId: session?.sub,
  });
  await db.activityLog.create({
    data: { jobId: job.id, actorId: session?.sub, action: `Job ${jobNumber} created from enquiry ${lead.leadNumber}` },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, jobId: job.id };
}

export async function scheduleVisit(leadId: string, date: string) {
  if (!date) return { error: "Pick a date", success: false as const };
  const session = await getSession();
  const when = new Date(date);
  await db.lead.update({
    where: { id: leadId },
    data: { followUpDate: when, stage: "SITE_VISIT" },
  });
  await db.followUp.create({
    data: {
      leadId,
      dueDate: when,
      type: "SITE_VISIT",
      priority: "HIGH",
      notes: "Site visit scheduled",
      assignedToId: session?.sub,
    },
  });
  await addTimelineEntry({
    leadId,
    type: "STAGE",
    body: "Stage → Site Visit",
    meta: { toStage: "SITE_VISIT" },
    authorId: session?.sub,
  });
  await addTimelineEntry({
    leadId,
    type: "FOLLOW_UP",
    body: `Site visit scheduled for ${when.toLocaleString("en-IN")}`,
    authorId: session?.sub,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addFollowUp(leadId: string, values: unknown) {
  const parsed = followUpSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();
  const due = combineDateTime(data.dueDate, data.dueTime || undefined);

  await db.followUp.create({
    data: {
      leadId,
      dueDate: due,
      type: data.type,
      priority: data.priority,
      notes: data.notes || null,
      assignedToId: session?.sub,
    },
  });
  await db.lead.update({ where: { id: leadId }, data: { followUpDate: due } });
  await addTimelineEntry({
    leadId,
    type: "FOLLOW_UP",
    body: `${FOLLOWUP_TYPE_LABELS[data.type]} follow-up set for ${due.toLocaleString("en-IN")}${
      data.notes ? ` — ${data.notes}` : ""
    }`,
    meta: { type: data.type, priority: data.priority },
    authorId: session?.sub,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function toggleFollowUpDone(followUpId: string, leadId: string) {
  const followUp = await db.followUp.findUnique({ where: { id: followUpId } });
  if (!followUp) return { error: "Not found" };
  const nowDone = !followUp.isDone;
  await db.followUp.update({
    where: { id: followUpId },
    data: { isDone: nowDone, doneAt: nowDone ? new Date() : null },
  });
  if (nowDone) {
    const session = await getSession();
    await addTimelineEntry({
      leadId,
      type: "FOLLOW_UP",
      body: `Follow-up completed${followUp.notes ? ` — ${followUp.notes}` : ""}`,
      authorId: session?.sub,
    });
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addNote(leadId: string, values: unknown) {
  const parsed = timelineNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note", success: false as const };
  }
  const session = await getSession();
  await addTimelineEntry({ leadId, type: "NOTE", body: parsed.data.body, authorId: session?.sub });
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
}

export async function addVoiceNote(leadId: string, audioUrl: string) {
  if (!audioUrl || !audioUrl.startsWith("/uploads/")) {
    return { error: "Invalid recording", success: false as const };
  }
  const session = await getSession();
  await addTimelineEntry({ leadId, type: "VOICE", audioUrl, authorId: session?.sub });
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
}

export async function logCall(leadId: string, values: unknown) {
  const parsed = callLogSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();
  await addTimelineEntry({
    leadId,
    type: "CALL",
    body: `Call — ${CALL_OUTCOME_LABELS[data.outcome]}${data.notes ? `: ${data.notes}` : ""}`,
    meta: { outcome: data.outcome },
    authorId: session?.sub,
  });

  // A confirmed call nudges the stage forward if still early.
  if (data.outcome === "INTERESTED") {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { stage: true } });
    if (lead?.stage === "NEW") {
      await db.lead.update({ where: { id: leadId }, data: { stage: "INTERESTED" } });
      await addTimelineEntry({
        leadId,
        type: "STAGE",
        body: "Stage → Interested",
        meta: { toStage: "INTERESTED" },
        authorId: session?.sub,
      });
    }
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
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

  if (lead.stage === "NEW" || lead.stage === "INTERESTED" || lead.stage === "SITE_VISIT") {
    await db.lead.update({ where: { id: leadId }, data: { stage: "QUOTATION", quoteAmount: totalAmount } });
  }

  const session = await getSession();
  await addTimelineEntry({
    leadId,
    type: "QUOTATION",
    body: `Quotation ${quoteNumber} generated — ₹${totalAmount.toLocaleString("en-IN")}`,
    meta: { quotationId: quotation.id, quoteNumber, totalAmount },
    authorId: session?.sub,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: true, quotationId: quotation.id };
}
