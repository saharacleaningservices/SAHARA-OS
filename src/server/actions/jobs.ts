"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jobSchema } from "@/lib/validation";
import { deriveArea } from "@/lib/utils";
import { notify } from "@/server/notify";
import { generateJobNumber, generateCertificateNumber, generateInvoiceNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { softDeleteMany } from "@/server/audit";
import { dispatchTeamForJob } from "@/server/dispatch";
import { sendWhatsApp } from "@/lib/whatsapp";
import { premiumReviewRequestMessage } from "@/lib/whatsapp-templates";
import { SERVICE_LABELS } from "@/lib/constants";
import { canAccessJob, getOwnStaffId } from "@/server/jobs";
import { sendBookingChangeNotice, sendBookingConfirmation } from "@/server/booking-messages";
import { freezeJobTeam, notifyCrewAssigned, notifyCrewChanged, notifyCrewRemoved } from "@/server/job-team";

/**
 * Francis (SUPERVISOR) final policy, 2026-09-21: "Edit ... only for TODAY
 * and TOMORROW" — enforced here at the server-action level (this action had
 * no session check at all before), not just by hiding/redirecting the edit
 * page, so a direct action call can't bypass it. No-op for every other role.
 */
async function assertJobEditable(jobId: string): Promise<{ error: string; success: false } | null> {
  const session = await getSession();
  if (!session || (session.role !== "SUPERVISOR" && session.role !== "OPERATIONS")) return null;
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { scheduledDate: true, supervisorId: true, assignments: { select: { staffId: true } } },
  });
  if (!job) return { error: "Job not found", success: false };
  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) {
    return { error: "You can only edit today's and tomorrow's jobs", success: false };
  }
  return null;
}

export async function createJob(values: unknown) {
  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();

  const formTeam = typeof data.teamNumber === "number" ? data.teamNumber : null;
  // Inherit the enquiry's team when the job form leaves it blank.
  const lead = data.leadId
    ? await db.lead.findUnique({ where: { id: data.leadId }, select: { teamNumber: true } })
    : null;
  const teamNumber = formTeam ?? lead?.teamNumber ?? null;

  const jobNumber = await generateJobNumber();
  const job = await db.job.create({
    data: {
      jobNumber,
      leadId: data.leadId || null,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      alternateMobile: data.alternateMobile || null,
      address: data.address,
      area: deriveArea(data),
      pinCode: data.pinCode || null,
      service: data.service,
      serviceVariant: data.serviceVariant || null,
      packageName: data.packageName || null,
      scheduledDate: new Date(data.scheduledDate),
      scheduledTime: data.scheduledTime,
      teamNumber,
      supervisorId: data.supervisorId || null,
      status: data.staffIds?.length ? "ASSIGNED" : "PENDING",
      jobValue: data.jobValue,
      notes: data.notes || null,
    },
  });

  if (data.staffIds?.length) {
    await db.jobAssignment.createMany({
      data: data.staffIds.map((staffId, i) => ({ jobId: job.id, staffId, isLead: i === 0 })),
    });
    await dispatchTeamForJob(job.id).catch(() => {});
    const crew = await db.staff.findMany({ where: { id: { in: data.staffIds } }, select: { name: true } });
    await notify({
      kind: "CREW_UPDATE",
      title: `Crew assigned — ${job.customerName}`,
      body: `${job.jobNumber} · ${crew.map((c) => c.name).join(", ")} · ${new Date(job.scheduledDate).toLocaleDateString("en-IN")} ${job.scheduledTime}`,
      href: `/jobs/${job.id}`,
    });
    await notifyCrewAssigned(job.id, data.staffIds);
  }

  if (data.leadId) {
    await db.lead.update({ where: { id: data.leadId }, data: { stage: "JOB_SCHEDULED" } });
    await addTimelineEntry({
      leadId: data.leadId,
      type: "JOB",
      body: `Job ${jobNumber} created — ${new Date(data.scheduledDate).toLocaleDateString("en-IN")} at ${data.scheduledTime}`,
      meta: { jobId: job.id, jobNumber },
      authorId: session?.sub,
    });
  }

  await db.activityLog.create({ data: { jobId: job.id, actorId: session?.sub, action: `Job ${jobNumber} created` } });

  // A job saved manually in the CRM is a confirmed booking — same customer
  // confirmation as an online request confirmed via confirmBooking().
  await sendBookingConfirmation(job.id).catch(() => {});

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, jobId: job.id };
}

export async function updateJob(id: string, values: unknown) {
  const scopeError = await assertJobEditable(id);
  if (scopeError) return scopeError;
  const parsed = jobSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const d = parsed.data;
  const before = await db.job.findUnique({
    where: { id },
    select: { scheduledDate: true, scheduledTime: true, status: true, assignments: { select: { staffId: true, isLead: true } } },
  });
  await db.job.update({
    where: { id },
    data: {
      ...(d.customerName && { customerName: d.customerName }),
      ...(d.customerMobile && { customerMobile: d.customerMobile }),
      ...(d.alternateMobile !== undefined && { alternateMobile: d.alternateMobile || null }),
      ...(d.address && { address: d.address }),
      ...(d.area && { area: d.area }),
      ...(d.pinCode !== undefined && { pinCode: d.pinCode || null }),
      ...(d.service && { service: d.service }),
      ...(d.serviceVariant !== undefined && { serviceVariant: d.serviceVariant || null }),
      ...(d.packageName !== undefined && { packageName: d.packageName || null }),
      ...(d.scheduledDate && { scheduledDate: new Date(d.scheduledDate) }),
      ...(d.scheduledTime && { scheduledTime: d.scheduledTime }),
      ...(d.teamNumber !== undefined && {
        teamNumber: typeof d.teamNumber === "number" ? d.teamNumber : null,
      }),
      ...(d.supervisorId !== undefined && { supervisorId: d.supervisorId || null }),
      ...(d.jobValue !== undefined && { jobValue: d.jobValue }),
      ...(d.notes !== undefined && { notes: d.notes || null }),
      ...(d.scopeOfWork !== undefined && { scopeOfWork: d.scopeOfWork || null }),
    },
  });

  // Multi-crew assignment — replace the crew list when the form sends one,
  // but only when it actually differs (members or lead): an unchanged crew
  // re-saved with the form no longer re-sends the WhatsApp dispatch or any
  // crew notification.
  const prevIds = before?.assignments.map((a) => a.staffId) ?? [];
  const prevLead = before?.assignments.find((a) => a.isLead)?.staffId ?? null;
  const nextIds = d.staffIds !== undefined ? [...new Set(d.staffIds.filter(Boolean))] : prevIds;
  const crewChanged =
    d.staffIds !== undefined &&
    (nextIds.length !== prevIds.length ||
      nextIds.some((s) => !prevIds.includes(s)) ||
      (nextIds[0] ?? null) !== prevLead);
  if (crewChanged) {
    const staffIds = nextIds;
    await db.jobAssignment.deleteMany({ where: { jobId: id } });
    if (staffIds.length) {
      await db.jobAssignment.createMany({
        data: staffIds.map((staffId, i) => ({ jobId: id, staffId, isLead: i === 0 })),
      });
      await dispatchTeamForJob(id).catch(() => {});
      const [job, crew] = await Promise.all([
        db.job.findUnique({ where: { id }, select: { jobNumber: true, customerName: true } }),
        db.staff.findMany({ where: { id: { in: staffIds } }, select: { name: true } }),
      ]);
      await notify({
        kind: "CREW_UPDATE",
        title: `Crew updated — ${job?.customerName ?? "job"}`,
        body: `${job?.jobNumber ?? ""} · ${crew.map((c) => c.name).join(", ")}`,
        href: `/jobs/${id}`,
      });
    }
  }

  const moved =
    before &&
    ((d.scheduledDate && new Date(d.scheduledDate).getTime() !== before.scheduledDate.getTime()) ||
      (d.scheduledTime && d.scheduledTime !== before.scheduledTime));
  if (moved) await sendBookingChangeNotice(id, "RESCHEDULED").catch(() => {});

  // Staff App — one notification per affected staff member per save.
  if (before && (crewChanged || moved)) {
    const added = nextIds.filter((s) => !prevIds.includes(s));
    const removed = prevIds.filter((s) => !nextIds.includes(s));
    const kept = nextIds.filter((s) => prevIds.includes(s));
    const what = [moved && "Date/time changed", crewChanged && "Team changed"].filter(Boolean).join(" · ");
    await notifyCrewAssigned(id, added);
    await notifyCrewChanged(id, kept, what);
    await notifyCrewRemoved(id, removed, before.scheduledDate);
    // An office correction to a completed job's crew re-freezes the history.
    if (crewChanged && before.status === "COMPLETED") await freezeJobTeam(id, { force: true });
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function deleteJob(id: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  await softDeleteMany("Job", [id], session);

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { success: true };
}

export async function bulkDeleteJobs(ids: string[]) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const count = await softDeleteMany("Job", ids, session);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, count };
}

const ALL_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "ON_THE_WAY",
  "STARTED",
  "COMPLETED",
  "POSTPONED",
  "CANCELLED",
  "REACTIVATED",
] as const;
type JobStatus = (typeof ALL_STATUSES)[number];

/**
 * Sends the "Job Completed — leave a Google Review" WhatsApp message exactly
 * once per job, the moment its status becomes COMPLETED — regardless of
 * which completion action triggered it (the plain "Mark Completed" status
 * button via updateJobStatus below, or "Complete & Generate Certificate" via
 * completeJobWithCertificate), and regardless of the job's originating lead
 * source (website booking, manual CRM entry, or GMB — all leads funnel into
 * the same Job model). A WhatsAppMessage existence check guards against a
 * duplicate send if both completion paths somehow run for the same job,
 * mirroring the dedup pattern already used in src/server/reminders.ts.
 */
async function sendJobCompletionReview(job: {
  id: string;
  jobNumber: string;
  customerName: string;
  customerMobile: string;
  service: string;
}) {
  const already = await db.whatsAppMessage.findFirst({
    where: { kind: "REVIEW_REQUEST", relatedType: "Job", relatedId: job.id },
  });
  if (already) return;

  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  await sendWhatsApp({
    kind: "REVIEW_REQUEST",
    toNumber: job.customerMobile,
    toName: job.customerName,
    body: premiumReviewRequestMessage({
      customerName: job.customerName,
      jobNumber: job.jobNumber,
      service: SERVICE_LABELS[job.service] ?? job.service,
      googleReviewUrl: settings?.googleReviewUrl ?? null,
    }),
    relatedType: "Job",
    relatedId: job.id,
  });
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  if (!ALL_STATUSES.includes(status)) return { error: "Invalid status", success: false as const };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const session = await getSession();
  const now = new Date();

  const job = await db.job.update({
    where: { id: jobId },
    data: {
      status,
      ...(status === "ON_THE_WAY" && { onTheWayAt: now }),
      ...(status === "STARTED" && { startedAt: now }),
      ...(status === "COMPLETED" && { completedAt: now }),
    },
  });

  await db.activityLog.create({
    data: { jobId, actorId: session?.sub, action: `Status changed to ${status.replaceAll("_", " ")}` },
  });

  if (status === "COMPLETED") {
    await freezeJobTeam(jobId).catch(() => {});
    await sendJobCompletionReview(job).catch(() => {});
  }
  if (status === "CANCELLED") {
    await sendBookingChangeNotice(jobId, "CANCELLED").catch(() => {});
    const crew = await db.jobAssignment.findMany({ where: { jobId }, select: { staffId: true } });
    await notifyCrewChanged(jobId, crew.map((c) => c.staffId), "Job cancelled").catch(() => {});
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function addJobPhoto(jobId: string, type: "BEFORE" | "AFTER", url: string, caption?: string) {
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const session = await getSession();
  await db.photo.create({ data: { jobId, type, url, caption: caption || null, uploadedById: session?.sub } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function addJobVideo(jobId: string, url: string, caption?: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  await db.jobVideo.create({ data: { jobId, url, caption: caption || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function completeJobWithCertificate(jobId: string) {
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const job = await db.job.findUnique({ where: { id: jobId }, include: { supervisor: true, certificate: true } });
  if (!job) return { error: "Job not found", success: false as const };

  const session = await getSession();
  const now = new Date();

  await db.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: job.completedAt ?? now },
  });
  await freezeJobTeam(jobId).catch(() => {});

  if (job.leadId) {
    await db.lead.update({ where: { id: job.leadId }, data: { stage: "COMPLETED" } }).catch(() => {});
    await addTimelineEntry({
      leadId: job.leadId,
      type: "STAGE",
      body: `Job ${job.jobNumber} completed`,
      meta: { toStage: "COMPLETED", jobId },
      authorId: session?.sub,
    }).catch(() => {});
  }

  let certificateId = job.certificate?.id;
  if (!job.certificate) {
    const certificateNumber = await generateCertificateNumber();
    const certificate = await db.certificate.create({
      data: {
        jobId,
        certificateNumber,
        customerName: job.customerName,
        serviceSummary: `${job.service.replaceAll("_", " ")} completed at ${job.area}.`,
        supervisorName: job.supervisor?.name,
        signatureUrl: null,
      },
    });
    certificateId = certificate.id;
  }

  let payment = await db.payment.findFirst({ where: { jobId } });
  if (!payment) {
    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    payment = await db.payment.create({
      data: {
        invoiceNumber,
        jobId,
        leadId: job.leadId,
        clientName: job.customerName,
        clientMobile: job.customerMobile,
        amount: job.jobValue,
        dueDate,
        status: "PENDING",
        recordedById: session?.sub,
      },
    });
    if (job.leadId) {
      await addTimelineEntry({
        leadId: job.leadId,
        type: "PAYMENT",
        body: `Invoice ${invoiceNumber} raised — ₹${job.jobValue.toLocaleString("en-IN")} due ${dueDate.toLocaleDateString("en-IN")}`,
        meta: { invoiceNumber, amount: job.jobValue },
        authorId: session?.sub,
      }).catch(() => {});
    }
  }

  // Generate + save a CRM-native invoice document (line items + PDF at
  // /api/invoices/[id]/pdf) the moment a job completes and its payment
  // record exists.
  const existingInvoice = await db.invoice.findUnique({ where: { jobId } });
  if (!existingInvoice) {
    const serviceLabel = SERVICE_LABELS[job.service] ?? job.service;
    await db.invoice.create({
      data: {
        invoiceNumber: payment.invoiceNumber,
        jobId,
        paymentId: payment.id,
        customerName: job.customerName,
        customerMobile: job.customerMobile,
        customerAddress: job.address,
        lineItems: JSON.stringify([
          { name: serviceLabel, description: `${serviceLabel} — ${job.area}`, amount: job.jobValue },
        ]),
        subTotal: job.jobValue,
        gstPercent: 0,
        gstAmount: 0,
        totalAmount: job.jobValue,
        status: "ISSUED",
      },
    });
  }

  // Review request — sent once, right after completion (shared helper also
  // covers the plain "Mark Completed" status-button path in updateJobStatus).
  await sendJobCompletionReview(job).catch(() => {});

  await db.activityLog.create({
    data: { jobId, actorId: session?.sub, action: "Job marked complete — certificate & invoice generated" },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { success: true as const, certificateId };
}

export async function updateJobLocation(jobId: string, mapLink: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  await db.job.update({ where: { id: jobId }, data: { mapLink: mapLink.trim() || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

/** Field-progress notes / remarks. Available to every role that can open the
 * job (Field Coordinator included) — the full job edit form stays manager-only. */
export async function updateJobNotes(jobId: string, notes: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const trimmed = notes.trim();
  if (trimmed.length > 2000) return { error: "Notes are too long (2000 characters max)" };
  await db.job.update({ where: { id: jobId }, data: { notes: trimmed || null } });
  await db.activityLog.create({
    data: { jobId, actorId: session.sub, action: "Job notes updated" },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function assignVehicle(jobId: string, vehicleId: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  await db.job.update({ where: { id: jobId }, data: { vehicleId: vehicleId || null } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { success: true as const };
}

export async function addMaterialIssue(jobId: string, item: string, quantity: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  if (!item.trim()) return { error: "Enter a material name" };
  await db.materialIssue.create({
    data: { jobId, item: item.trim(), quantity: quantity.trim() || null, issuedByName: session.name },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

/** Manual "Send Team Dispatch" button — resends the WhatsApp job brief to
 * every assigned staff member (e.g. after a vehicle/material change). */
export async function sendTeamDispatch(jobId: string) {
  const session = await getSession();
  if (!session) return { success: false as const, error: "Not authorized", sent: 0, queued: 0 };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return { ...scopeError, sent: 0, queued: 0 };
  // Francis (SUPERVISOR) final policy, 2026-09-21: Team Dispatch is a
  // TODAY-ONLY operational action for him.
  if (session.role === "SUPERVISOR") {
    const job = await db.job.findUnique({ where: { id: jobId }, select: { scheduledDate: true } });
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (!job || job.scheduledDate < startToday || job.scheduledDate > endToday) {
      return { success: false as const, error: "Team Dispatch is only available for today's jobs", sent: 0, queued: 0 };
    }
  }
  const result = await dispatchTeamForJob(jobId);
  await db.activityLog
    .create({
      data: {
        jobId,
        actorId: session.sub,
        action: `Team dispatch sent (${result.sent} sent, ${result.queued} queued — no WhatsApp credentials yet)`,
      },
    })
    .catch(() => {});
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, error: undefined as string | undefined, sent: result.sent, queued: result.queued };
}
