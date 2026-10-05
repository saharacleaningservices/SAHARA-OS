"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyCrewAssigned } from "@/server/job-team";
import { getSession } from "@/lib/session";
import { enforcePricing, packageTotals, parsePackage, serializeLines, canEditPackagePricing } from "@/lib/package-calc";
import { getLivePricing } from "@/server/pricing";

import { rescheduleJobFromLead, syncLeadFromJob } from "@/server/job-schedule";
import {
  leadSchema,
  quickCaptureSchema,
  followUpSchema,
  confirmBookingSchema,
  callLogSchema,
  timelineNoteSchema,
} from "@/lib/validation";
import { generateLeadNumber, generateQuoteNumber, generateJobNumber, generateInvoiceNumber } from "@/lib/id-generators";
import { deriveArea } from "@/lib/utils";
import { notify } from "@/server/notify";
import {
  QUOTATION_TERMS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  FOLLOWUP_TYPE_LABELS,
  CALL_OUTCOME_LABELS,
  COMPANY,
} from "@/lib/constants";
import { addTimelineEntry } from "@/server/timeline";
import { softDeleteMany } from "@/server/audit";
import { dispatchTeamForJob } from "@/server/dispatch";
import { sendBookingConfirmation } from "@/server/booking-messages";
import { canAccessLead } from "@/server/leads";
import { channelForManualLead } from "@/lib/attribution";

/**
 * Francis (SUPERVISOR) final policy, 2026-09-21: "Edit allowed lead/booking
 * operational fields only for TODAY and TOMORROW" — enforced here, at the
 * server-action level, not just by hiding the edit UI, so a direct action
 * call can't bypass it. No-op (returns null) for every other role.
 */
async function assertLeadEditable(leadId: string): Promise<{ error: string } | null> {
  const session = await getSession();
  // Field Staff / signed-out callers never edit enquiries (defence in depth behind the middleware).
  if (!session || session.role === "STAFF") return { error: "Not authorized" };
  if (session.role !== "SUPERVISOR" && session.role !== "OPERATIONS") return null;
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { followUpDate: true, serviceDate: true, createdAt: true, stage: true, assignedToId: true, createdById: true },
  });
  if (!lead || !canAccessLead(session, lead)) {
    return { error: "You can only edit today's and tomorrow's leads/bookings" };
  }
  return null;
}


/**
 * Package Calculator lines → stored package. Prices are re-checked against the
 * live pricing master: only Super Admin / Accounts may change unit price or give
 * a discount. When a package is present, the lead amount = package final amount.
 */
async function packageFields(serviceItems: string | undefined, discountAmount: number | undefined, role?: string) {
  if (serviceItems === undefined) return null;
  if (!serviceItems) return { serviceItems: null, discountAmount: null } as const;
  const { items } = await getLivePricing();
  const draft = enforcePricing(parsePackage(serviceItems, discountAmount ?? 0), items, canEditPackagePricing(role));
  if (draft.lines.length === 0) return { serviceItems: null, discountAmount: null } as const;
  const t = packageTotals(draft);
  return { serviceItems: serializeLines(draft), discountAmount: t.discount, quoteAmount: t.final } as const;
}

const MIN_JOB_VALUE = COMPANY.minimumJobValue;

function combineDateTime(date: string, time?: string) {
  return time ? new Date(`${date}T${time}`) : new Date(date);
}

/** Normalises a validated team value (number | "" | undefined) to 1–4 or null. */
function normalizeTeam(value: number | "" | undefined): number | null {
  return typeof value === "number" && value >= 1 && value <= 4 ? value : null;
}

/**
 * Duplicate-lead prevention: one open enquiry per mobile number. Staff update
 * the existing enquiry instead (the public booking form already does this).
 */
async function findOpenDuplicateLead(mobile: string) {
  const last10 = mobile.replace(/\D/g, "").slice(-10);
  if (last10.length !== 10) return null;
  return db.lead.findFirst({
    where: {
      deletedAt: null,
      mobile: { endsWith: last10 },
      stage: { in: ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] },
    },
    select: { leadNumber: true },
  });
}

const duplicateLeadError = (leadNumber: string) =>
  `An open enquiry ${leadNumber} already exists for this mobile number — open and update it instead.`;

export async function createLead(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const session = await getSession();
  const data = parsed.data;

  const openDuplicate = await findOpenDuplicateLead(data.mobile);
  if (openDuplicate) return { error: duplicateLeadError(openDuplicate.leadNumber) };

  const channel = channelForManualLead(data.source, data.acquisitionChannel);
  const campaign = data.acquisitionCampaign?.trim() || null;
  const now = new Date();

  const pkg = await packageFields(data.serviceItems, data.discountAmount, session?.role);
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      ...(pkg ?? {}),
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternateMobile || null,
      whatsapp: data.whatsapp || data.mobile,
      email: data.email || null,
      address: data.address || null,
      area: deriveArea(data),
      pinCode: data.pinCode || null,
      addOnServices: data.addOnServices?.length ? JSON.stringify(data.addOnServices) : null,
      service: data.service,
      source: data.source,
      quoteAmount: pkg && "quoteAmount" in pkg ? pkg.quoteAmount : (data.quoteAmount ?? null),
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      serviceDate: data.serviceDate ? new Date(data.serviceDate) : null,
      timeSlot: data.timeSlot || null,
      teamNumber: normalizeTeam(data.teamNumber),
      assignedStaffId: data.assignedStaffIds?.[0] || data.assignedStaffId || null,
      assignedStaffIds: data.assignedStaffIds?.length ? JSON.stringify(data.assignedStaffIds) : null,
      notes: data.notes || null,
      scopeOfWork: data.scopeOfWork || null,
      serviceCategory: (data.serviceCategory as never) || null,
      serviceVariant: data.serviceVariant || null,
      packageName: data.packageName || null,
      propertyType: data.propertyType || null,
      comboServices: data.comboServices?.length ? JSON.stringify(data.comboServices) : null,
      advanceAmount: data.advanceAmount ?? null,
      paymentMode: data.paymentMode || null,
      paymentStatus: data.paymentStatus || (data.advanceAmount ? "PARTIAL" : "PENDING"),
      mapLink: data.mapLink || null,
      acquisitionChannel: channel,
      acquisitionCampaign: campaign,
      firstTouchSource: channel,
      firstTouchCampaign: campaign,
      firstTouchAt: now,
      latestTouchSource: channel,
      latestTouchCampaign: campaign,
      latestTouchAt: now,
      createdById: session?.sub,
      assignedToId: data.assignedToId || session?.sub,
    },
  });

  // Office recorded an advance → create the Payment row so it flows to the
  // Payments module + revenue.
  if (data.advanceAmount && data.advanceAmount > 0) {
    const total = data.quoteAmount && data.quoteAmount > 0 ? data.quoteAmount : data.advanceAmount;
    await db.payment
      .create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          leadId: lead.id,
          clientName: data.name,
          clientMobile: data.mobile,
          amount: total,
          paidAmount: data.advanceAmount,
          dueDate: data.serviceDate ? new Date(data.serviceDate) : new Date(Date.now() + 7 * 86400000),
          paidDate: new Date(),
          status: data.advanceAmount >= total ? "PAID" : "PENDING",
          mode: data.paymentMode || null,
          notes: `Advance recorded on lead ${leadNumber}`,
          recordedById: session?.sub,
        },
      })
      .catch(() => {});
  }

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

  await notify({
    kind: "NEW_INQUIRY",
    title: `New enquiry — ${data.name}`,
    body: `${data.service.replaceAll("_", " ")} · ☎ ${data.mobile}`,
    href: `/leads/${lead.id}`,
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, leadId: lead.id };
}

/** AI Quick Capture — mobile + name + area + service, everything else later. */
export async function quickCaptureLead(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const parsed = quickCaptureSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const session = await getSession();
  const data = parsed.data;

  const openDuplicate = await findOpenDuplicateLead(data.mobile);
  if (openDuplicate) return { error: duplicateLeadError(openDuplicate.leadNumber) };

  const now = new Date();
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: data.name,
      mobile: data.mobile,
      whatsapp: data.mobile,
      area: deriveArea(data),
      pinCode: data.pinCode || null,
      service: data.service,
      source: "CALL",
      acquisitionChannel: "Phone Call",
      firstTouchSource: "Phone Call",
      firstTouchAt: now,
      latestTouchSource: "Phone Call",
      latestTouchAt: now,
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
  const scopeError = await assertLeadEditable(id);
  if (scopeError) return scopeError;
  const parsed = leadSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const data = parsed.data;
  const before = await db.lead.findUnique({ where: { id }, select: { serviceDate: true, timeSlot: true } });
  const pkg = await packageFields(data.serviceItems, data.discountAmount, (await getSession())?.role);
  await db.lead.update({
    where: { id },
    data: {
      ...(pkg ?? {}),
      ...(data.name && { name: data.name }),
      ...(data.mobile && { mobile: data.mobile }),
      ...(data.alternateMobile !== undefined && { alternateMobile: data.alternateMobile || null }),
      ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.area && { area: data.area }),
      ...(data.pinCode !== undefined && { pinCode: data.pinCode || null }),
      ...(data.addOnServices !== undefined && {
        addOnServices: data.addOnServices?.length ? JSON.stringify(data.addOnServices) : null,
      }),
      ...(data.service && { service: data.service }),
      ...(data.source && { source: data.source }),
      ...(data.quoteAmount !== undefined && !(pkg && "quoteAmount" in pkg) && { quoteAmount: data.quoteAmount }),
      ...(data.followUpDate !== undefined && {
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      }),
      ...(data.serviceDate !== undefined && {
        serviceDate: data.serviceDate ? new Date(data.serviceDate) : null,
      }),
      ...(data.timeSlot !== undefined && { timeSlot: data.timeSlot || null }),
      ...(data.teamNumber !== undefined && { teamNumber: normalizeTeam(data.teamNumber) }),
      ...(data.assignedStaffIds !== undefined && {
        assignedStaffIds: data.assignedStaffIds?.length ? JSON.stringify(data.assignedStaffIds) : null,
        assignedStaffId: data.assignedStaffIds?.[0] ?? null,
      }),
      ...(data.assignedStaffIds === undefined &&
        data.assignedStaffId !== undefined && {
          assignedStaffId: data.assignedStaffId || null,
        }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.scopeOfWork !== undefined && { scopeOfWork: data.scopeOfWork || null }),
      ...(data.serviceCategory !== undefined && { serviceCategory: (data.serviceCategory as never) || null }),
      ...(data.serviceVariant !== undefined && { serviceVariant: data.serviceVariant || null }),
      ...(data.packageName !== undefined && { packageName: data.packageName || null }),
      ...(data.propertyType !== undefined && { propertyType: data.propertyType || null }),
      ...(data.comboServices !== undefined && {
        comboServices: data.comboServices?.length ? JSON.stringify(data.comboServices) : null,
      }),
      ...(data.advanceAmount !== undefined && { advanceAmount: data.advanceAmount ?? null }),
      ...(data.paymentMode !== undefined && { paymentMode: data.paymentMode || null }),
      ...(data.paymentStatus !== undefined && { paymentStatus: data.paymentStatus || null }),
      ...(data.mapLink !== undefined && { mapLink: data.mapLink || null }),
    },
  });
  // Booked enquiry: a date/slot the office actually changed here moves the job too
  // (schedule, calendar, customer notice, crew). Re-saving an unchanged form never
  // moves the job — the job stays the source of truth for the schedule.
  const newDate = data.serviceDate ? new Date(data.serviceDate) : null;
  const dateChanged = data.serviceDate !== undefined && (newDate?.getTime() ?? null) !== (before?.serviceDate?.getTime() ?? null);
  const slotChanged = data.timeSlot !== undefined && (data.timeSlot || null) !== (before?.timeSlot ?? null);
  const session = await getSession();
  const movedJobId = dateChanged || slotChanged ? await rescheduleJobFromLead(id, dateChanged ? newDate : null, slotChanged ? data.timeSlot || null : null, session?.sub) : null;
  // Any booked enquiry is re-mirrored from its job after a save, so stale form
  // values (e.g. an old follow-up date) never override the job's schedule.
  const bookedJob = await db.job.findFirst({ where: { leadId: id, deletedAt: null }, select: { id: true } });
  if (bookedJob) await syncLeadFromJob(movedJobId ?? bookedJob.id, session?.sub);
  if (movedJobId) {
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${movedJobId}`);
  }
  if (bookedJob) revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { success: true, leadId: id };
}

export async function deleteLead(id: string) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return { error: "Not authorized" };

  await softDeleteMany("Lead", [id], session);

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkDeleteLeads(ids: string[]) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return { error: "Not authorized" };
  const count = await softDeleteMany("Lead", ids, session);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, count };
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
  if (!session || session.role === "STAFF") return { error: "Not authorized", success: false as const };
  const current = await db.lead.findUnique({
    where: { id: leadId },
    select: { stage: true, followUpDate: true, serviceDate: true, createdAt: true, assignedToId: true, createdById: true },
  });
  // A booked enquiry's stage follows its job — change the job status instead,
  // so the job, schedule, staff and customer stay consistent.
  const job = await db.job.findFirst({ where: { leadId, deletedAt: null }, select: { jobNumber: true } });
  if (job && (stage === "JOB_SCHEDULED" || stage === "COMPLETED" || stage === "CANCELLED")) {
    return { error: `This enquiry has job ${job.jobNumber} — update the job status (it updates the enquiry too).`, success: false as const };
  }
  if ((session?.role === "SUPERVISOR" || session?.role === "OPERATIONS") && (!current || !canAccessLead(session, current))) {
    return { error: "You can only update today's and tomorrow's leads/bookings", success: false as const };
  }
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
  if (!session || session.role === "STAFF") return { error: "Not authorized", success: false as const };

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found", success: false as const };
  if ((session?.role === "SUPERVISOR" || session?.role === "OPERATIONS") && !canAccessLead(session, lead)) {
    return { error: "You can only confirm bookings for today's and tomorrow's leads", success: false as const };
  }

  const existingJob = await db.job.findFirst({ where: { leadId, deletedAt: null }, select: { jobNumber: true } });
  if (existingJob) {
    return { error: `This enquiry already has job ${existingJob.jobNumber}.`, success: false as const };
  }
  // Atomic claim: only one confirm can move the enquiry to "Job Scheduled", so a
  // double click / two users can never create two jobs for the same enquiry.
  const claimed = await db.lead.updateMany({ where: { id: leadId, stage: { notIn: ["JOB_SCHEDULED", "COMPLETED"] } }, data: { stage: "JOB_SCHEDULED" } });
  if (claimed.count === 0) return { error: "This booking is already confirmed.", success: false as const };

  const scheduledDate = new Date(data.serviceDate);
  // Transparent-pricing bookings keep their real total (no minimum booking
  // value); the legacy minimum is only a fallback when no amount exists.
  const jobValue = lead.quoteAmount && lead.quoteAmount > 0 ? lead.quoteAmount : MIN_JOB_VALUE;

  // Team carries over from the enquiry; the confirm dialog can override it.
  const teamNumber = normalizeTeam(data.teamNumber) ?? lead.teamNumber ?? null;

  const jobNumber = await generateJobNumber();
  const job = await db.job
    .create({
    data: {
      jobNumber,
      leadId,
      paymentPreference: lead.paymentPreference ?? null,
      customerName: lead.name,
      customerMobile: lead.mobile,
      alternateMobile: lead.alternateMobile,
      address: lead.address || lead.area,
      area: lead.area,
      service: lead.service,
      serviceVariant: lead.serviceVariant,
      propertyType: lead.propertyType,
      packageName: lead.packageName,
      comboServices: lead.comboServices,
      // Package Calculator lines + discount travel with the booking (jobValue = final amount).
      serviceItems: lead.serviceItems,
      discountAmount: lead.discountAmount,
      // Confirmed package price snapshot + scope travel with the booking.
      priceType: lead.priceType,
      festivalName: lead.festivalName,
      scopeOfWork: lead.scopeOfWork,
      pinCode: lead.pinCode,
      mapLink: lead.mapLink,
      scheduledDate,
      scheduledTime: data.timeSlot,
      teamNumber,
      supervisorId: data.supervisorId || null,
      jobValue,
      notes: `Auto-created from enquiry ${lead.leadNumber}`,
    },
  })
    .catch(async (err) => {
      await db.lead.update({ where: { id: leadId }, data: { stage: lead.stage } }); // release the claim
      throw err;
    });

  // Carry the lead's assigned crew (multi-staff) onto the job.
  const leadStaffIds: string[] = lead.assignedStaffIds
    ? (JSON.parse(lead.assignedStaffIds) as string[])
    : lead.assignedStaffId
      ? [lead.assignedStaffId]
      : [];
  if (leadStaffIds.length) {
    await db.jobAssignment.createMany({
      data: [...new Set(leadStaffIds)].map((staffId, i) => ({ jobId: job.id, staffId, isLead: i === 0 })),
    });
    const crew = await db.staff.findMany({ where: { id: { in: leadStaffIds } }, select: { name: true } });
        await notify({
                kind: "CREW_UPDATE",
                title: `Crew assigned — ${job.customerName}`,
                body: `${job.jobNumber} · ${crew.map((c) => c.name).join(", ")} · ${scheduledDate.toLocaleDateString("en-IN")} ${data.timeSlot}`,
                href: `/jobs/${job.id}`,
        });
    await notifyCrewAssigned(job.id, [...new Set(leadStaffIds)]);
  }

  // Payments — attach any advance the customer already paid to the job, and
  // make sure there's a Payment row for the balance (quote − advance).
  const leadPayments = await db.payment.findMany({ where: { leadId, deletedAt: null } });
  if (leadPayments.length > 0) {
    await db.payment.updateMany({ where: { leadId, deletedAt: null }, data: { jobId: job.id, amount: jobValue } });
  } else {
    const advance = lead.advanceAmount ?? 0;
    await db.payment
      .create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          jobId: job.id,
          leadId,
          clientName: lead.name,
          clientMobile: lead.mobile,
          amount: jobValue,
          paidAmount: advance,
          dueDate: scheduledDate,
          paidDate: advance > 0 ? new Date() : null,
          status: advance >= jobValue && advance > 0 ? "PAID" : "PENDING",
          mode: lead.paymentMode || null,
          notes: `Booking confirmed from enquiry ${lead.leadNumber}`,
          recordedById: session?.sub,
        },
      })
      .catch(() => {});
  }

  await db.lead.update({
    where: { id: leadId },
    data: { stage: "JOB_SCHEDULED", followUpDate: scheduledDate, serviceDate: scheduledDate, timeSlot: data.timeSlot, teamNumber },
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

  // ONE WhatsApp booking confirmation, identical for every lead source and
  // for manual CRM jobs (createJob) — see src/server/booking-messages.ts,
  // which also owns the once-per-job duplicate guard.
  await sendBookingConfirmation(job.id).catch(() => {});
  await dispatchTeamForJob(job.id).catch(() => {});

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, jobId: job.id };
}

export async function scheduleVisit(leadId: string, date: string) {
  if (!date) return { error: "Pick a date", success: false as const };
  const scopeError = await assertLeadEditable(leadId);
  if (scopeError) return { ...scopeError, success: false as const };
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
  const visitLead = await db.lead.findUnique({ where: { id: leadId }, select: { name: true, mobile: true } });
  await notify({
    kind: "SITE_VISIT",
    title: `Site visit — ${visitLead?.name ?? "customer"}`,
    body: `${when.toLocaleString("en-IN")}${visitLead?.mobile ? ` · ☎ ${visitLead.mobile}` : ""}`,
    href: `/leads/${leadId}`,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addFollowUp(leadId: string, values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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
  // Instant alert only for imminent follow-ups (next 3 hours).
  if (due.getTime() <= Date.now() + 3 * 3600 * 1000) {
    const fl = await db.lead.findUnique({ where: { id: leadId }, select: { name: true, mobile: true } });
    await notify({
      kind: "FOLLOWUP_DUE",
      title: `Follow-up due — ${fl?.name ?? "lead"}`,
      body: `${FOLLOWUP_TYPE_LABELS[data.type]} at ${due.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${
        data.notes ? ` · ${data.notes}` : fl?.mobile ? ` · ☎ ${fl.mobile}` : ""
      }`,
      href: `/leads/${leadId}`,
    });
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function toggleFollowUpDone(followUpId: string, leadId: string) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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

/**
 * Edit / reschedule an existing follow-up — change its due date & time,
 * type, priority or notes. Fixes the "follow-up date can't be edited" gap:
 * previously a follow-up could only be created then ticked done.
 */
export async function updateFollowUp(followUpId: string, leadId: string, values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const parsed = followUpSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const existing = await db.followUp.findUnique({ where: { id: followUpId } });
  if (!existing || existing.leadId !== leadId) return { error: "Not found", success: false as const };

  const session = await getSession();
  const due =
    data.dueDate !== undefined && data.dueDate
      ? combineDateTime(data.dueDate, data.dueTime || undefined)
      : existing.dueDate;

  await db.followUp.update({
    where: { id: followUpId },
    data: {
      dueDate: due,
      ...(data.type !== undefined && { type: data.type }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  // Keep the lead's headline followUpDate in step with its earliest open follow-up.
  const nextOpen = await db.followUp.findFirst({
    where: { leadId, isDone: false },
    orderBy: { dueDate: "asc" },
  });
  await db.lead.update({
    where: { id: leadId },
    data: { followUpDate: nextOpen?.dueDate ?? null },
  });

  await addTimelineEntry({
    leadId,
    type: "FOLLOW_UP",
    body: `Follow-up rescheduled to ${due.toLocaleString("en-IN")}${data.notes ? ` — ${data.notes}` : ""}`,
    authorId: session?.sub,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function addNote(leadId: string, values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  if (!audioUrl || !audioUrl.startsWith("/uploads/")) {
    return { error: "Invalid recording", success: false as const };
  }
  const session = await getSession();
  await addTimelineEntry({ leadId, type: "VOICE", audioUrl, authorId: session?.sub });
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
}

export async function logCall(leadId: string, values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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
  gstPercent: number,
  discount = 0,
) {
  const scopeError = await assertLeadEditable(leadId);
  if (scopeError) return scopeError;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found" };

  const subTotal = services.reduce((sum, s) => sum + s.amount, 0);
  // Discount: Super Admin / Accounts may set any; others only the package discount already approved on the lead.
  const role = (await getSession())?.role;
  const allowed = canEditPackagePricing(role) ? subTotal : Math.min(subTotal, lead.discountAmount ?? 0);
  const disc = Math.max(0, Math.min(Number(discount) || 0, allowed));
  const gstAmount = Math.round(((subTotal - disc) * gstPercent) / 100);
  const totalAmount = subTotal - disc + gstAmount;

  const quoteNumber = await generateQuoteNumber();
  const quotation = await db.quotation.create({
    data: {
      quoteNumber,
      leadId,
      services: JSON.stringify(services),
      subTotal,
      discount: disc,
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

export async function updateLeadLocation(leadId: string, mapLink: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertLeadEditable(leadId);
  if (scopeError) return scopeError;
  await db.lead.update({ where: { id: leadId }, data: { mapLink } });
  await addTimelineEntry({ leadId, type: "SYSTEM", body: "Location shared", authorId: session.sub });
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
}

/** One-click repeat booking — clone the customer's last job into a fresh lead. */
export async function createRepeatBooking(mobile: string) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const digits = mobile.replace(/[^\d]/g, "").slice(-10);

  const lastJob = await db.job.findFirst({
    where: { customerMobile: digits, deletedAt: null },
    orderBy: { scheduledDate: "desc" },
  });
  const master = await db.customer.findUnique({ where: { mobile: digits } }).catch(() => null);
  const lastLead = await db.lead.findFirst({
    where: { mobile: digits, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!lastJob && !lastLead && !master) return { error: "No history for this customer" };

  const name = lastJob?.customerName || lastLead?.name || master?.name || "Customer";
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name,
      mobile: digits,
      whatsapp: digits,
      address: lastJob?.address || lastLead?.address || master?.address || null,
      area: lastJob?.area || lastLead?.area || master?.area || "—",
      service: (lastJob?.service || lastLead?.service || "HOME_DEEP_CLEANING") as never,
      serviceVariant: lastJob?.serviceVariant || lastLead?.serviceVariant || null,
      propertyType: lastJob?.propertyType || lastLead?.propertyType || null,
      source: "CALL" as never,
      stage: "NEW",
      notes: `Repeat booking${lastJob ? ` — previous job ${lastJob.jobNumber}` : ""}`,
      createdById: session.sub,
      assignedToId: session.sub,
    },
  });

  await addTimelineEntry({
    leadId: lead.id,
    type: "SYSTEM",
    body: `Repeat booking created by ${session.name}${lastJob ? ` from job ${lastJob.jobNumber}` : ""}`,
    authorId: session.sub,
  }).catch(() => {});

  await db.followUp
    .create({
      data: {
        leadId: lead.id,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        type: "CALL",
        priority: "HIGH",
        notes: "Confirm repeat booking details",
      },
    })
    .catch(() => {});

  revalidatePath("/leads");
  revalidatePath(`/customers/${digits}`);
  return { success: true as const, leadId: lead.id, leadNumber };
}
