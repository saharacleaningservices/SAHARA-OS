// The crew job card. PRIVACY RULE (owner 2026-10-22, tightened 2026-10-23): the card carries ONLY the job ID, service
// category, package, date & time slot, site address (with its map link) and the assigned team / supervisor. The customer's
// phone number and every amount are never selected here, so they cannot reach the card, its PDF or the WhatsApp group text.
// The select list below is the whole contract — add a field only after the owner agrees a technician needs it.
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export type CrewCard = {
  jobNumber: string;
  service: string;
  packageLabel: string | null;
  date: Date;
  timeSlot: string;
  area: string;
  address: string;
  mapLink: string | null;
  team: string | null;
  crew: string[];
  supervisor: string | null;
};

export async function getCrewCard(jobId: string): Promise<CrewCard | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      jobNumber: true, scheduledDate: true, scheduledTime: true, area: true, address: true, mapLink: true, service: true,
      packageName: true, serviceVariant: true, teamNumber: true,
      supervisor: { select: { name: true } },
      assignments: { select: { isLead: true, staff: { select: { name: true } } } },
    },
  });
  if (!job) return null;
  return {
    jobNumber: job.jobNumber,
    service: SERVICE_LABELS[job.service] ?? job.service,
    // "3 BHK — Platinum": the flat type first, then the package, without repeating one that equals the other.
    packageLabel: [job.serviceVariant, job.packageName && job.packageName !== job.serviceVariant ? job.packageName : null].filter(Boolean).join(" — ") || null,
    date: job.scheduledDate,
    timeSlot: job.scheduledTime,
    area: job.area,
    address: job.address,
    mapLink: job.mapLink,
    team: job.teamNumber ? `Team ${job.teamNumber}` : null,
    crew: job.assignments.map((a) => (a.isLead ? `${a.staff.name} (lead)` : a.staff.name)),
    supervisor: job.supervisor?.name ?? null,
  };
}

/**
 * Plain text for a team WhatsApp group (shared by the office from its own phone): no phone, no amounts.
 * Compact on purpose (owner 2026-10-26): the location is plain text and the job-card link is the ONLY URL, so WhatsApp never
 * builds a bulky Google Maps preview box. The Maps button lives on the job card the link opens.
 */
export function crewGroupMessage(c: CrewCard, cardLink: string): string {
  return [
    `📋 *Job ${c.jobNumber}*`,
    `${c.service}${c.packageLabel ? ` — ${c.packageLabel}` : ""}`,
    `🗓 ${formatDate(c.date)} · ${c.timeSlot}`,
    `📍 ${c.area}`,
    c.team || c.crew.length ? `👥 ${[c.team, c.crew.join(", ")].filter(Boolean).join(" · ")}` : null,
    c.supervisor ? `🧑‍💼 ${c.supervisor}` : null,
    `🧾 Job card & map: ${cardLink}`,
  ].filter(Boolean).join("\n");
}
