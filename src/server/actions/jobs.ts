"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";
import { syncLeadFromJob } from "@/server/job-schedule";
import { packageToQuoteItems, packageTotals, parsePackage } from "@/lib/package-calc";
import { jobSchema } from "@/lib/validation";
import { deriveArea } from "@/lib/utils";
import { notify } from "@/server/notify";
import { generateJobNumber, generateCertificateNumber, generateInvoiceNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { softDeleteMany } from "@/server/audit";
import { dispatchTeamForJob } from "@/server/dispatch";
import { enqueueJobCompletedNotice, enqueueServiceStartedNotice, enqueueTeamDispatch } from "@/server/job-queue-handlers";
import { SERVICE_LABELS } from "@/lib/constants";
import { canAccessJob, getOwnStaffId } from "@/server/jobs";
import { sendBookingChangeNotice, sendBookingConfirmation } from "@/server/booking-messages";
import { sendReviewIfDue } from "@/server/job-review";
import { cleanFix, locationNote, type GeoFix } from "@/lib/geo";
import { freezeJobTeam, notifyCrewAssigned, notifyCrewChanged, notifyCrewRemoved } from "@/server/job-team";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Francis (SUPERVISOR) final policy, 2026-09-21: "Edit ... only for TODAY
 * and TOMORROW" — enforced here at the server-action level (this action had
 * no session check at all before), not just by hiding/redirecting the edit
 * page, so a direct action call can't bypass it. No-op for every other role.
 */
async function assertJobEditable(jobId: string, opts: { staffAllowed?: boolean } = {}): Promise<{ error: string; success: false } | null> {
  const session = await getSession();
  // RBAC 2026-10-05: a session is always required; Field Staff may only use the
  // actions that explicitly allow them (photos/videos/status from the Staff App),
  // and only on their own job scheduled for today.
  if (!session) return { error: "Not authorized", success: false };
  if (session.role === "STAFF") {
    if (!opts.staffAllowed) return { error: "Not authorized", success: false };
    const job = await db.job.findUnique({ where: { id: jobId }, select: { scheduledDate: true, supervisorId: true, assignments: { select: { staffId: true } } } });
    if (!job) return { error: "Job not found", success: false };
    const own = await getOwnStaffId(session.sub);
    return canAccessJob(session, job, own) ? null : { error: "Not your job today", success: false };
  }
  if (session.role !== "SUPERVISOR" && session.role !== "OPERATIONS") return null;
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { scheduledDate: true, supervisorId: true, assignments: { select: { staffId: true } } },
  });
  if (!job) return { error: "Job not found", success: false };
  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) {
    return { error: session.role === "OPERATIONS" ? "You can only open yesterday's, today's and tomorrow's jobs" : "You can only edit today's and tomorrow's jobs", success: false };
  }
  return null;
}

export async function createJob(values: unknown) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const parsed = jobSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const session = await getSession();

  const formTeam = typeof data.teamNumber === "number" ? data.teamNumber : null;
  // Inherit the enquiry's team when the job form leaves it blank.
  const lead = data.leadId
    ? await db.lead.findUnique({ where: { id: data.leadId }, select: { teamNumber: true, quoteAmount: true } })
    : null;
  const teamNumber = formTeam ?? lead?.teamNumber ?? null;
  // A role that never sees job amounts can't set one: use the enquiry's quote.
  if (!session || !canViewJobAmount(session.role)) data.jobValue = lead?.quoteAmount ?? 0;

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
    void enqueueTeamDispatch(job.id); // queued (SQLite), retried with back-off — never blocks the request
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
  void sendBookingConfirmation(job.id).catch(() => {}); // background — the save returns at once

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
  // Restricted roles never see these fields, so never let them overwrite them.
  const editor = await getSession();
  if (!editor || !canSeeCustomerContact(editor.role)) {
    delete d.customerMobile;
    delete d.alternateMobile;
  }
  if (!editor || !canViewJobAmount(editor.role)) delete d.jobValue;
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
      void enqueueTeamDispatch(id); // queued (SQLite), retried with back-off
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
  if (moved) void sendBookingChangeNotice(id, "RESCHEDULED").catch(() => {}); // background
  // The enquiry mirrors the job's schedule (dashboard, today/tomorrow access, follow-up).
  if (moved) {
    const actor = (await getSession())?.sub;
    await db.activityLog.create({ data: { jobId: id, actorId: actor ?? null, action: `Rescheduled to ${d.scheduledDate ?? before!.scheduledDate.toISOString().slice(0, 10)} ${d.scheduledTime ?? before!.scheduledTime}` } });
    await syncLeadFromJob(id, actor).catch(() => {});
  }

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

/**
 * Reschedule = move the SAME job to a new date/time (never a new job). Updates the
 * job, the linked enquiry, the job lists/calendar/dashboard (all read the job),
 * the customer notice and the assigned crew. A postponed job comes back as
 * Scheduled (crew assigned) or Pending (no crew).
 */
export async function rescheduleJob(jobId: string, date: string, time: string, reason?: string) {
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time?.trim()) return { error: "Choose the new date and time", success: false as const };
  const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true, scheduledDate: true, scheduledTime: true, deletedAt: true, assignments: { select: { staffId: true } } } });
  if (!job || job.deletedAt) return { error: "Job not found", success: false as const };
  if (job.status === "COMPLETED" || job.status === "CANCELLED") return { error: "A completed or cancelled job can't be rescheduled — reactivate it first.", success: false as const };
  const res = await updateJob(jobId, { scheduledDate: date, scheduledTime: time.trim() });
  if ("error" in res && res.error) return res;
  const session = await getSession();
  if (reason?.trim()) await db.activityLog.create({ data: { jobId, actorId: session?.sub ?? null, action: `Reschedule reason: ${reason.trim().slice(0, 200)}` } });
  if (job.status === "POSTPONED") await updateJobStatusInternal(jobId, job.assignments.length ? "ASSIGNED" : "PENDING", session?.sub);
  return { success: true as const };
}

export async function deleteJob(id: string) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  await softDeleteMany("Job", [id], session);

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { success: true };
}

export async function bulkDeleteJobs(ids: string[]) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
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
 * The job's Final Invoice — created once, the moment the job is COMPLETED, from
 * the job's own data (package lines / discount / complimentary, job value) and
 * linked to its payment record and the lead's quotation. Idempotent: a job that
 * already has an invoice is left untouched. Advance / balance / payment status
 * are read live from the job's payments wherever the invoice is shown.
 */
async function createFinalInvoice(jobId: string, actorId?: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "COMPLETED" || job.deletedAt) return null;
  const existing = await db.invoice.findUnique({ where: { jobId } });
  if (existing) return existing;
  // Accounts may already have converted this enquiry's quotation into an invoice:
  // link that one to the job (so its PDF shows the job's payments) instead of
  // raising a second invoice for the same sale.
  if (job.leadId) {
    const fromQuote = await db.invoice.findFirst({
      where: { jobId: null, status: { not: "CANCELLED" }, quotation: { leadId: job.leadId } },
      orderBy: { createdAt: "desc" },
    });
    if (fromQuote) return db.invoice.update({ where: { id: fromQuote.id }, data: { jobId } });
  }

  const now = new Date();
  let payment = await db.payment.findFirst({ where: { jobId, deletedAt: null }, orderBy: { createdAt: "asc" } });
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
        recordedById: actorId,
      },
    });
    if (job.leadId) {
      await addTimelineEntry({
        leadId: job.leadId,
        type: "PAYMENT",
        body: `Invoice ${invoiceNumber} raised — ₹${job.jobValue.toLocaleString("en-IN")} due ${dueDate.toLocaleDateString("en-IN")}`,
        meta: { invoiceNumber, amount: job.jobValue },
        authorId: actorId,
      }).catch(() => {});
    }
  }
  // Invoice numbers are unique — an advance payment's number may already be taken by another invoice.
  const numberTaken = await db.invoice.findUnique({ where: { invoiceNumber: payment.invoiceNumber }, select: { id: true } });
  const paymentTaken = await db.invoice.findUnique({ where: { paymentId: payment.id }, select: { id: true } });
  const invoiceNumber = numberTaken ? await generateInvoiceNumber() : payment.invoiceNumber;

  // Customer → Lead → Quotation → Job → Invoice: link the lead's latest live quotation.
  const quotation = job.leadId
    ? await db.quotation.findFirst({
        where: { leadId: job.leadId, status: { notIn: ["REJECTED", "EXPIRED"] }, invoice: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, terms: true },
      })
    : null;

  const serviceLabel = SERVICE_LABELS[job.service] ?? job.service;
  // Multi-service package → one invoice line per service + the discount; else one line.
  const pkg = parsePackage(job.serviceItems, job.discountAmount);
  const pkgTotals = packageTotals(pkg);
  // GST (optional, B2B): jobValue already carries it, so the taxable base is jobValue minus the GST.
  const gstAmt = job.gstEnabled ? job.gstAmount : 0;
  const baseTotal = job.jobValue - gstAmt;
  const usePkg = pkg.lines.length > 0 && Math.abs(pkgTotals.final - baseTotal) < 0.01;
  const pkgName = [job.serviceVariant && job.serviceVariant !== job.packageName ? job.serviceVariant : null, job.packageName].filter(Boolean).join(" ");
  const title = [serviceLabel, pkgName].filter(Boolean).join(" — ");
  const areaText = job.area && !/^[\d\s-]+$/.test(job.area) ? job.area : null;
  const lineDetail = [job.priceType === "FESTIVAL" && job.festivalName ? `${job.festivalName} price` : null, areaText].filter(Boolean).join(" · ") || serviceLabel;
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      jobId,
      paymentId: paymentTaken ? null : payment.id,
      quotationId: quotation?.id ?? null,
      customerName: job.customerName,
      customerMobile: job.customerMobile,
      customerAddress: job.address,
      lineItems: JSON.stringify(usePkg ? packageToQuoteItems(pkg) : [{ name: title, description: lineDetail, amount: baseTotal }]),
      subTotal: usePkg ? pkgTotals.subtotal : baseTotal,
      discount: usePkg ? pkgTotals.discount : 0,
      gstPercent: gstAmt > 0 ? 18 : 0,
      gstAmount: gstAmt,
      totalAmount: job.jobValue,
      notes: job.scopeOfWork || null,
      terms: quotation?.terms ?? null,
      status: "ISSUED",
    },
  });
  await db.activityLog.create({ data: { jobId, actorId, action: `Final invoice ${invoiceNumber} generated` } }).catch(() => {});
  revalidatePath("/invoices");
  revalidatePath("/payments");
  return invoice;
}

/** Office: generate the Final Invoice for a completed job that has none (jobs completed before auto-invoicing). */
export async function generateFinalInvoice(jobId: string) {
  const session = await getSession();
  if (!session || !["ADMIN", "ACCOUNTS", "OPERATIONS"].includes(session.role)) return { error: "Not authorized", success: false as const };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) return { error: "Job not found", success: false as const };
  if (job.status !== "COMPLETED") return { error: "The final invoice is available once the job is completed.", success: false as const };
  const invoice = await createFinalInvoice(jobId, session.sub);
  if (!invoice) return { error: "Could not generate the invoice", success: false as const };
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, invoiceNumber: invoice.invoiceNumber };
}

export async function updateJobStatus(jobId: string, status: JobStatus, location?: unknown) {
  if (!ALL_STATUSES.includes(status)) return { error: "Invalid status", success: false as const };
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const session = await getSession();
  return updateJobStatusInternal(jobId, status, session?.sub, status === "STARTED" ? cleanFix(location) ?? "none" : undefined);
}

async function updateJobStatusInternal(jobId: string, status: JobStatus, actorId?: string, fix?: GeoFix | "none") {
  const session = { sub: actorId };
  const now = new Date();
  // Same status again (double tap / two people) → no duplicate log, message or alert.
  const current = await db.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!current) return { error: "Job not found", success: false as const };
  if (current.status === status) return { success: true as const, unchanged: true as const };

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
    data: { jobId, actorId: session?.sub, action: `Status changed to ${status.replaceAll("_", " ")}${fix === undefined ? "" : locationNote(fix === "none" ? null : fix)}` },
  });

  if (status === "STARTED") void enqueueServiceStartedNotice(jobId); // "Work started" message — a no-op until its template is approved and switched on
  if (status === "COMPLETED") {
    await freezeJobTeam(jobId).catch(() => {});
    // Final invoice is generated + stored automatically on completion (any completion path).
    await createFinalInvoice(jobId, actorId).catch((e) => console.error("[invoice] auto-generate failed:", e));
    void sendReviewIfDue(job.id).catch(() => {}); // background — sends once, and only when nothing is left to collect
    void enqueueJobCompletedNotice(job.id); // Pay Balance link — a no-op until sahara_job_completed_v1 is approved and switched on
  }
  if (status === "CANCELLED") {
    void sendBookingChangeNotice(jobId, "CANCELLED").catch(() => {}); // background
    const crew = await db.jobAssignment.findMany({ where: { jobId }, select: { staffId: true } });
    await notifyCrewChanged(jobId, crew.map((c) => c.staffId), "Job cancelled").catch(() => {});
  }
  if (status === "POSTPONED" || status === "REACTIVATED") {
    const crew = await db.jobAssignment.findMany({ where: { jobId }, select: { staffId: true } });
    await notifyCrewChanged(jobId, crew.map((c) => c.staffId), status === "POSTPONED" ? "Job postponed" : "Job reactivated").catch(() => {});
  }
  // Lead stage follows the job (Completed / Cancelled / Job Scheduled).
  await syncLeadFromJob(jobId, actorId).catch(() => {});

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

/**
 * Customer booking page → "Mark Work Completed" (third completion touchpoint besides the Staff App and the CRM). The unguessable booking
 * token is the only credential, so it is allowed only for a job whose service has STARTED, and it runs the same completion path as the
 * other two (status, timestamps, final invoice, Invoice + Google review WhatsApp message). Rate-limited per address and per booking.
 */
export async function customerConfirmWorkCompleted(token: string): Promise<{ success: true } | { success: false; error: string }> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) return { success: false, error: "Invalid booking link" };
  try {
    const ip = clientIp(await headers());
    if (!rateLimit(`complete:ip:${ip}`, 20, 600).allowed || !rateLimit(`complete:tok:${token}`, 5, 600).allowed) return { success: false, error: "Too many requests — please try again in a few minutes." };
  } catch {
    /* outside an HTTP request (tests): no throttling */
  }
  const job = await db.job.findFirst({ where: { publicToken: token, deletedAt: null, isDemo: false }, select: { id: true, status: true } });
  if (!job) return { success: false, error: "Booking not found" };
  if (job.status === "COMPLETED") return { success: true };
  if (job.status !== "STARTED") return { success: false, error: "Our team has not started the service yet — you can confirm completion once it has." };
  await db.activityLog.create({ data: { jobId: job.id, action: "Customer confirmed work completed (booking page)" } }).catch(() => {});
  const r = await updateJobStatusInternal(job.id, "COMPLETED", undefined);
  revalidatePath(`/booking/${token}`);
  return "error" in r && r.error ? { success: false, error: r.error } : { success: true };
}

/**
 * Staff App: move MY job of today forward — Assigned → On the way → Started →
 * Completed. No other status, no financial fields; every change is logged.
 */
export async function staffUpdateJobStatus(jobId: string, status: "ON_THE_WAY" | "STARTED" | "COMPLETED") {
  const session = await getSession();
  if (!session || session.role !== "STAFF") return { error: "Not authorized", success: false as const };
  const order = ["PENDING", "ASSIGNED", "REACTIVATED", "ON_THE_WAY", "STARTED", "COMPLETED"];
  if (!["ON_THE_WAY", "STARTED", "COMPLETED"].includes(status)) return { error: "Invalid status", success: false as const };
  const scopeError = await assertJobEditable(jobId, { staffAllowed: true });
  if (scopeError) return scopeError;
  const current = await db.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!current || order.indexOf(status) <= order.indexOf(current.status)) return { error: "This step is already done", success: false as const };
  return updateJobStatusInternal(jobId, status, session.sub);
}

/**
 * Field staff record that the customer verbally agreed to WhatsApp offers on site.
 * One-way (UNKNOWN → OPTED_IN): staff can never opt a customer out, and never override an
 * existing opt-out (STOP / office-recorded). Audit-logged with the staff member as actor.
 */
export async function staffRecordJobConsent(jobId: string) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") return { error: "Not authorized", success: false as const };
  const scopeError = await assertJobEditable(jobId, { staffAllowed: true });
  if (scopeError) return scopeError;
  const job = await db.job.findUnique({ where: { id: jobId }, select: { jobNumber: true, leadId: true, lead: { select: { marketingConsent: true, leadNumber: true } } } });
  if (!job?.leadId || !job.lead) return { error: "No customer record linked to this job", success: false as const };
  if (job.lead.marketingConsent === "OPTED_OUT") return { error: "Customer has opted out", success: false as const };
  if (job.lead.marketingConsent === "OPTED_IN") return { success: true as const };
  await db.lead.update({ where: { id: job.leadId }, data: { marketingConsent: "OPTED_IN", marketingConsentAt: new Date() } });
  await db.auditLog
    .create({
      data: {
        entityType: "Lead",
        entityId: job.leadId,
        action: "MARKETING_OPT_IN_RECORDED",
        summary: `${job.lead.leadNumber}: verbal WhatsApp consent recorded on site by staff (${job.jobNumber})`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  revalidatePath(`/leads/${job.leadId}`);
  return { success: true as const };
}

export async function addJobPhoto(jobId: string, type: "BEFORE" | "AFTER", url: string, caption?: string) {
  const scopeError = await assertJobEditable(jobId, { staffAllowed: true });
  if (scopeError) return scopeError;
  const session = await getSession();
  await db.photo.create({ data: { jobId, type, url, caption: caption || null, uploadedById: session?.sub } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function addJobVideo(jobId: string, url: string, caption?: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const scopeError = await assertJobEditable(jobId, { staffAllowed: true });
  if (scopeError) return scopeError;
  await db.jobVideo.create({ data: { jobId, url, caption: caption || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const };
}

export async function completeJobWithCertificate(jobId: string, location?: unknown) {
  const scopeError = await assertJobEditable(jobId);
  if (scopeError) return scopeError;
  const job = await db.job.findUnique({ where: { id: jobId }, include: { supervisor: true, certificate: true } });
  if (!job) return { error: "Job not found", success: false as const };

  const session = await getSession();
  const now = new Date();
  // Already completed (double tap / second user) → no second review, log or invoice.
  if (job.status === "COMPLETED") return { success: true as const, certificateId: job.certificate?.id, unchanged: true as const };
  if (job.status === "CANCELLED") return { error: "This job is cancelled — reactivate it first.", success: false as const };

  await db.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED", completedAt: job.completedAt ?? now },
  });
  await freezeJobTeam(jobId).catch(() => {});
  // Enquiry follows its job(s) — safe when an enquiry has more than one job.
  await syncLeadFromJob(jobId, session?.sub).catch(() => {});

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

  await createFinalInvoice(jobId, session?.sub).catch((e) => console.error("[invoice] auto-generate failed:", e));

  // Review request — sent once, right after completion (shared helper also
  // covers the plain "Mark Completed" status-button path in updateJobStatus).
  void sendReviewIfDue(job.id).catch(() => {}); // background — sends once, and only when nothing is left to collect
  void enqueueJobCompletedNotice(job.id);

  await db.activityLog.create({
    data: { jobId, actorId: session?.sub, action: `Job marked complete — certificate generated${locationNote(cleanFix(location))}` },
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
        action: "muted" in result ? "Team dispatch: staff WhatsApp alerts are off — the crew sees this job in the Staff App" : `Team dispatch sent (${result.sent} sent, ${result.queued} queued)`,
      },
    })
    .catch(() => {});
  revalidatePath(`/jobs/${jobId}`);
  return { success: true as const, error: undefined as string | undefined, sent: result.sent, queued: result.queued };
}
