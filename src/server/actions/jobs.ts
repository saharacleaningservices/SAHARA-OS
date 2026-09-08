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
import { reviewRequestMessage } from "@/lib/whatsapp-templates";
import { syncInvoiceToMyBillBook } from "@/lib/mybillbook";
import { SERVICE_LABELS } from "@/lib/constants";

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

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, jobId: job.id };
}

export async function updateJob(id: string, values: unknown) {
  const parsed = jobSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const d = parsed.data;
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
    },
  });

  // Multi-crew assignment — replace the crew list when the form sends one.
  if (d.staffIds !== undefined) {
    const staffIds = [...new Set(d.staffIds.filter(Boolean))];
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

export async function updateJobStatus(jobId: string, status: JobStatus) {
  if (!ALL_STATUSES.includes(status)) return { error: "Invalid status", success: false as const };
  const session = await getSession();
  const now = new Date();

  await db.job.update({
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

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function addJobPhoto(jobId: string, type: "BEFORE" | "AFTER", url: string, caption?: string) {
  const session = await getSession();
  await db.photo.create({ data: { jobId, type, url, caption: caption || null, uploadedById: session?.sub } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function addJobVideo(jobId: string, url: string, caption?: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  await db.jobVideo.create({ data: { jobId, url, caption: caption || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function completeJobWithCertificate(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { supervisor: true, certificate: true } });
  if (!job) return { error: "Job not found", success: false as const };

  const session = await getSession();
  const now = new Date();

  await db.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: job.completedAt ?? now },
  });

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

  // MyBillBook: generate + save a CRM-native invoice document (line items +
  // PDF at /api/invoices/[id]/pdf), then attempt the MyBillBook push. The
  // push is a no-op (marked NOT_CONFIGURED) until MYBILLBOOK_API_KEY exists.
  const existingInvoice = await db.invoice.findUnique({ where: { jobId } });
  if (!existingInvoice) {
    const serviceLabel = SERVICE_LABELS[job.service] ?? job.service;
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: payment.invoiceNumber,
        jobId,
        paymentId: payment.id,
        customerName: job.customerName,
        customerMobile: job.customerMobile,
        customerAddress: job.address,
        lineItems: JSON.stringify([{ name: serviceLabel, description: `${serviceLabel} — ${job.area}`, amount: job.jobValue }]),
        subTotal: job.jobValue,
        gstPercent: 0,
        gstAmount: 0,
        totalAmount: job.jobValue,
      },
    });
    await syncInvoiceToMyBillBook(invoice.id).catch(() => {});
  }

  // Review request — sent once, right after completion.
  await sendWhatsApp({
    kind: "REVIEW_REQUEST",
    toNumber: job.customerMobile,
    toName: job.customerName,
    body: reviewRequestMessage({
      customerName: job.customerName,
      service: SERVICE_LABELS[job.service] ?? job.service,
      googleReviewUrl: (await db.companySettings.findUnique({ where: { id: "default" } }))?.googleReviewUrl ?? null,
      jobNumber: job.jobNumber,
    }),
    relatedType: "Job",
    relatedId: jobId,
  }).catch(() => {});

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
  await db.job.update({ where: { id: jobId }, data: { mapLink: mapLink.trim() || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function assignVehicle(jobId: string, vehicleId: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  await db.job.update({ where: { id: jobId }, data: { vehicleId: vehicleId || null } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { success: true as const };
}

export async function addMaterialIssue(jobId: string, item: string, quantity: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
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
  const result = await dispatchTeamForJob(jobId);
  await db.activityLog.create({
    data: {
      jobId,
      actorId: session.sub,
      action: `Team dispatch sent (${result.sent} sent, ${result.queued} queued — no WhatsApp credentials yet)`,
    },
  }).catch(() => {});
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, error: undefined as string | undefined, sent: result.sent, queued: result.queued };
}
