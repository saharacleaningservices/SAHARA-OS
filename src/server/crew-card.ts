// The crew job card. PRIVACY RULE (owner 2026-10-22): the customer's phone number and every payment amount are never
// selected here, so they cannot reach the page, the dispatch message or the WhatsApp group card. The select list below is
// the whole contract — add a field only after asking whether a technician needs it.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";

export type CrewCard = {
  jobNumber: string;
  date: Date;
  timeSlot: string;
  area: string;
  address: string;
  mapLink: string | null;
  service: string;
  packageName: string | null;
  flatType: string | null;
  team: number | null;
  supervisor: string | null;
  vehicle: string | null;
  material: string[];
  scope: string[];
  note: string | null;
};

export async function getCrewCard(jobId: string): Promise<CrewCard | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      jobNumber: true, scheduledDate: true, scheduledTime: true, area: true, address: true, mapLink: true, service: true,
      packageName: true, serviceVariant: true, teamNumber: true, notes: true, scopeOfWork: true,
      supervisor: { select: { name: true } },
      vehicle: { select: { name: true, plateNumber: true } },
      materialIssues: { select: { item: true, quantity: true } },
    },
  });
  if (!job) return null;
  return {
    jobNumber: job.jobNumber,
    date: job.scheduledDate,
    timeSlot: job.scheduledTime,
    area: job.area,
    address: job.address,
    mapLink: job.mapLink,
    service: SERVICE_LABELS[job.service] ?? job.service,
    packageName: job.packageName,
    flatType: job.serviceVariant,
    team: job.teamNumber,
    supervisor: job.supervisor?.name ?? null,
    vehicle: job.vehicle ? `${job.vehicle.name} (${job.vehicle.plateNumber})` : null,
    material: job.materialIssues.map((m) => (m.quantity ? `${m.item} × ${m.quantity}` : m.item)),
    scope: (job.scopeOfWork ?? "").split(/\n+/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean),
    note: job.notes,
  };
}
