// Team Dispatch — composes the job-dispatch WhatsApp message (customer name,
// area, map link, service, time slot, vehicle, material list — customer
// phone number never included) and sends it to every staff member currently
// assigned to the job. See src/lib/whatsapp.ts for why this is one message
// per staff member rather than a single post into a native WhatsApp group.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { teamDispatchMessage } from "@/lib/whatsapp-templates";

export async function dispatchTeamForJob(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      vehicle: true,
      materialIssues: true,
      assignments: { include: { staff: true } },
    },
  });
  if (!job) return { sent: 0, queued: 0 };

  const body = teamDispatchMessage({
    customerName: job.customerName,
    area: job.area,
    mapLink: job.mapLink,
    service: SERVICE_LABELS[job.service] ?? job.service,
    date: job.scheduledDate,
    timeSlot: job.scheduledTime,
    vehicle: job.vehicle ? `${job.vehicle.name} (${job.vehicle.plateNumber})` : null,
    materials: job.materialIssues.map((m) => (m.quantity ? `${m.item} x${m.quantity}` : m.item)),
  });

  let sent = 0;
  let queued = 0;
  for (const a of job.assignments) {
    if (!a.staff?.mobile) continue;
    const res = await sendWhatsApp({
      kind: "TEAM_DISPATCH",
      toNumber: a.staff.mobile,
      toName: a.staff.name,
      body,
      relatedType: "Job",
      relatedId: job.id,
    });
    if (res.sent) sent += 1;
    else queued += 1;
  }
  return { sent, queued };
}
