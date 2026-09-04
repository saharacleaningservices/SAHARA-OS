"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jobSchema } from "@/lib/validation";
import { generateJobNumber, generateCertificateNumber, generateInvoiceNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";

export async function createJob(values: unknown) {
  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();

  const jobNumber = await generateJobNumber();
  const job = await db.job.create({
    data: {
      jobNumber,
      leadId: data.leadId || null,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      address: data.address,
      area: data.area,
      service: data.service,
      scheduledDate: new Date(data.scheduledDate),
      scheduledTime: data.scheduledTime,
      supervisorId: data.supervisorId || null,
      jobValue: data.jobValue,
      notes: data.notes || null,
    },
  });

  if (data.staffIds?.length) {
    await db.jobAssignment.createMany({
      data: data.staffIds.map((staffId, i) => ({ jobId: job.id, staffId, isLead: i === 0 })),
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
      ...(d.address && { address: d.address }),
      ...(d.area && { area: d.area }),
      ...(d.service && { service: d.service }),
      ...(d.scheduledDate && { scheduledDate: new Date(d.scheduledDate) }),
      ...(d.scheduledTime && { scheduledTime: d.scheduledTime }),
      ...(d.supervisorId !== undefined && { supervisorId: d.supervisorId || null }),
      ...(d.jobValue !== undefined && { jobValue: d.jobValue }),
      ...(d.notes !== undefined && { notes: d.notes || null }),
    },
  });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function deleteJob(id: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  // Detach records that aren't cascade-deleted.
  await db.payment.updateMany({ where: { jobId: id }, data: { jobId: null } });
  await db.expense.updateMany({ where: { jobId: id }, data: { jobId: null } });
  // Cascades assignments, photos, certificate and activity logs.
  await db.job.delete({ where: { id } });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { success: true };
}

const STATUS_FLOW = ["ASSIGNED", "ON_THE_WAY", "STARTED", "COMPLETED"] as const;
type JobStatus = (typeof STATUS_FLOW)[number];

export async function updateJobStatus(jobId: string, status: JobStatus) {
  if (!STATUS_FLOW.includes(status)) return { error: "Invalid status", success: false as const };
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

export async function saveJobSignature(jobId: string, dataUrl: string) {
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl);
  if (!match) return { error: "Invalid signature data", success: false as const };

  const ext = match[1] === "jpeg" ? "jpg" : "png";
  const buffer = Buffer.from(match[2], "base64");
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "signatures");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  const url = `/uploads/signatures/${filename}`;

  await db.job.update({ where: { id: jobId }, data: { customerSignatureUrl: url, signedAt: new Date() } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, url };
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
        signatureUrl: job.customerSignatureUrl,
      },
    });
    certificateId = certificate.id;
  }

  const existingPayment = await db.payment.findFirst({ where: { jobId } });
  if (!existingPayment) {
    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    await db.payment.create({
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

  await db.activityLog.create({
    data: { jobId, actorId: session?.sub, action: "Job marked complete — certificate & invoice generated" },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { success: true as const, certificateId };
}
