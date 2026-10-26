// Day sheet: every job of one India-time day on a single printable page for the dispatcher / team leads. PRIVACY RULE: same contract as
// the crew job card (src/server/crew-card.ts) — job ID, service, package, time slot, area, site address, map link, team, crew,
// supervisor and status. No customer name, phone or amount is selected, so none can reach the sheet.
import { db } from "@/lib/db";
import { JOB_STATUS_LABELS, SERVICE_LABELS } from "@/lib/constants";
import { istDayRange } from "@/lib/ist-days";

export type DaySheetRow = {
  jobNumber: string;
  time: string;
  service: string;
  packageLabel: string | null;
  area: string;
  address: string;
  mapLink: string | null;
  team: string | null;
  crew: string[];
  supervisor: string | null;
  status: string;
};

export async function getDaySheet(day: Date): Promise<DaySheetRow[]> {
  const { from, to } = istDayRange(day);
  const jobs = await db.job.findMany({
    where: { deletedAt: null, isDemo: false, status: { not: "CANCELLED" }, scheduledDate: { gte: from, lt: to } },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }, { jobNumber: "asc" }],
    select: {
      jobNumber: true, scheduledTime: true, service: true, packageName: true, serviceVariant: true, area: true, address: true, mapLink: true, teamNumber: true, status: true,
      supervisor: { select: { name: true } },
      assignments: { select: { isLead: true, staff: { select: { name: true } } } },
    },
  });
  return jobs.map((j) => ({
    jobNumber: j.jobNumber,
    time: j.scheduledTime,
    service: SERVICE_LABELS[j.service] ?? j.service,
    packageLabel: [j.serviceVariant, j.packageName && j.packageName !== j.serviceVariant ? j.packageName : null].filter(Boolean).join(" — ") || null,
    area: j.area,
    address: j.address,
    mapLink: j.mapLink,
    team: j.teamNumber ? `Team ${j.teamNumber}` : null,
    crew: j.assignments.map((a) => (a.isLead ? `${a.staff.name} (lead)` : a.staff.name)),
    supervisor: j.supervisor?.name ?? null,
    status: JOB_STATUS_LABELS[j.status] ?? j.status,
  }));
}
