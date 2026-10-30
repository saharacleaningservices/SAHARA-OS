import { revalidatePath } from "next/cache";
import type { Lead } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { COMPANY } from "@/lib/constants";
import { generateJobNumber, generateInvoiceNumber } from "@/lib/id-generators";
import type { ConfirmBookingFormValues } from "@/lib/validation";
import { notify } from "@/server/notify";
import { notifyCrewAssigned } from "@/server/job-team";
import { addTimelineEntry } from "@/server/timeline";
import { enqueueTeamDispatch } from "@/server/job-queue-handlers";
import { sendBookingConfirmation } from "@/server/booking-messages";

// Server-only core of "Confirm Booking" (enquiry -> scheduled Job): shared by the CRM's Confirm Booking action
// (actions/leads.ts confirmBooking, which does the session / role / scope checks first) and the website's
// instant confirmation (server/public-auto-confirm.ts). NOT a server action - never import it from a client
// component and never add "use server" here: callers are responsible for authorisation.

const MIN_JOB_VALUE = COMPANY.minimumJobValue;

/** Normalises a validated team value (number | "" | undefined) to 1-4 or null. */
function normalizeTeam(value: number | "" | null | undefined): number | null {
  return typeof value === "number" && value >= 1 && value <= 4 ? value : null;
}

export async function confirmLeadIntoJob(lead: Lead, data: ConfirmBookingFormValues, actorId?: string | null) {
  const leadId = lead.id;
  const existingJob = await db.job.findFirst({ where: { leadId, deletedAt: null }, select: { jobNumber: true } });
  if (existingJob) {
    return { error: `This enquiry already has job ${existingJob.jobNumber}.`, success: false as const };
  }
  // Atomic claim: only one confirm can move the enquiry to "Job Scheduled", so a
  // double click / two users can never create two jobs for the same enquiry.
  const claimed = await db.lead.updateMany({ where: { id: leadId, stage: { notIn: ["JOB_SCHEDULED", "COMPLETED"] } }, data: { stage: "JOB_SCHEDULED" } });
  if (claimed.count === 0) return { error: "This booking is already confirmed.", success: false as const };

  const scheduledDate = new Date(data.serviceDate);
  // Bookings keep their real total — there is NO minimum booking value (owner
  // decision 2026-10-10; MIN_JOB_VALUE is 0). Without a priced amount the job
  // starts at 0 for the office to price; nothing is raised automatically.
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
      siteId: lead.siteId,
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
  // The pop-up's team crew (when picked) wins over the enquiry's own crew; only real, active staff are assigned.
  const pickedIds = data.staffIds?.length ? (await db.staff.findMany({ where: { id: { in: data.staffIds }, isActive: true }, select: { id: true } })).map((x) => x.id) : [];
  const orderedPicked = (data.staffIds ?? []).filter((id) => pickedIds.includes(id));
  const leadStaffIds: string[] = orderedPicked.length
    ? orderedPicked
    : lead.assignedStaffIds
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
    // The amount changes to the job value, so PAID must be re-derived from what
    // was actually collected — a part-paid advance can't stay marked PAID.
    for (const p of leadPayments) {
      const paid = p.paidAmount ?? 0;
      const fullyPaid = paid > 0 && paid >= jobValue - 0.01;
      await db.payment.update({
        where: { id: p.id },
        data: { jobId: job.id, amount: jobValue, status: fullyPaid ? "PAID" : p.status === "PAID" ? "PENDING" : p.status },
      });
    }
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
          recordedById: actorId,
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
    authorId: actorId,
  });
  await addTimelineEntry({
    leadId,
    type: "JOB",
    body: `Job ${jobNumber} scheduled — ${data.serviceDate} at ${data.timeSlot}`,
    meta: { jobId: job.id, jobNumber, date: data.serviceDate, slot: data.timeSlot },
    authorId: actorId,
  });
  await db.activityLog.create({
    data: { jobId: job.id, actorId: actorId, action: `Job ${jobNumber} created from enquiry ${lead.leadNumber}` },
  });

  // ONE WhatsApp booking confirmation, identical for every lead source and
  // for manual CRM jobs (createJob) — see src/server/booking-messages.ts,
  // which also owns the once-per-job duplicate guard.
  // Meta round-trips run in the background (in order) so Confirm Booking returns at once.
  void (async () => {
    await sendBookingConfirmation(job.id).catch(() => {});
    await enqueueTeamDispatch(job.id);
  })();

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true as const, jobId: job.id };
}
