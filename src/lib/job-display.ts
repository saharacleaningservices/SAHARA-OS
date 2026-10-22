// Display-only job helpers (owner 2026-10-22). The JobStatus enum, the Staff App step order, cron jobs and WhatsApp flows
// keep the eight stored statuses; the CRM shows them as six clear labels. Nothing in the database is rewritten.

export const JOB_DISPLAY_STATUSES = ["CONFIRMED", "WORK_STARTED", "COMPLETED", "POSTPONED", "CANCELLED", "PENDING_WORK"] as const;
export type JobDisplayStatus = (typeof JOB_DISPLAY_STATUSES)[number];

export const JOB_DISPLAY_LABELS: Record<JobDisplayStatus, string> = {
  CONFIRMED: "Confirmed",
  WORK_STARTED: "Work Started",
  COMPLETED: "Completed",
  POSTPONED: "Postponed / Rescheduled",
  CANCELLED: "Cancelled",
  PENDING_WORK: "Pending Work",
};

// ASSIGNED shows as "Confirmed" whether or not a crew is attached yet, so a job with "No crew assigned yet" no longer
// reads "Assigned". The crew warning stays on the job page and in the unassigned-team alert.
const FROM_STORED: Record<string, JobDisplayStatus> = {
  PENDING: "PENDING_WORK",
  ASSIGNED: "CONFIRMED",
  REACTIVATED: "CONFIRMED",
  ON_THE_WAY: "WORK_STARTED",
  STARTED: "WORK_STARTED",
  COMPLETED: "COMPLETED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

export function jobDisplayStatus(stored: string): JobDisplayStatus | null {
  return FROM_STORED[stored] ?? null;
}

export function jobDisplayLabel(stored: string): string {
  const d = jobDisplayStatus(stored);
  return d ? JOB_DISPLAY_LABELS[d] : stored;
}

/** Stored statuses behind one display status (for list filters). */
export function storedStatusesFor(display: JobDisplayStatus): string[] {
  return Object.entries(FROM_STORED)
    .filter(([, d]) => d === display)
    .map(([s]) => s);
}

/** Does a job with this stored status match a filter value? Accepts a display key or (old links) a stored status. */
export function jobMatchesStatusFilter(stored: string, filter: string): boolean {
  if (!filter || filter === "ALL") return true;
  if ((JOB_DISPLAY_STATUSES as readonly string[]).includes(filter)) return jobDisplayStatus(stored) === filter;
  return stored === filter;
}

/**
 * Strip a leftover "Cus " / "Cus." / "Cus-" prefix from imported customer names ("Cus Prajakta Patil" becomes
 * "Prajakta Patil"). Display only: the stored name is not changed. Words that merely start with "cus" (Cushman,
 * Customer) are kept.
 */
export function cleanCustomerName(name: string | null | undefined): string {
  const raw = name ?? "";
  const cleaned = raw.replace(/^\s*cus\b[\s.:_-]*/i, "").trim();
  return cleaned || raw.trim();
}
