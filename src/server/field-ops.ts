// Live Field Ops — office read model (2026-11-13). One query: every job that is live today or still in the field.
import { db } from "@/lib/db";
import { istDayRange } from "@/lib/ist-days";
import { canViewGps, fieldStage, gpsSubjectOf, type FieldStage } from "@/lib/field-ops";

export type FieldOpsRow = {
  id: string;
  jobNumber: string;
  customerName: string;
  area: string;
  service: string;
  scheduledTime: string;
  status: string;
  stage: FieldStage;
  team: { name: string; isLead: boolean }[];
  reachedAt: Date | null;
  gpsFlag: string | null;
  reachedDistanceM: number | null;
  reachedAccuracyM: number | null;
  mapHref: string | null;
  startOtp: string | null;
  startOtpAttempts: number;
  otpVerifiedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  billed: number;
  collectedAmount: number | null;
  collectedMode: string | null;
  pendingReason: string | null;
  /** Cash a staff member collected on site and the office has not yet received. */
  cashWithStaff: { name: string; amount: number; at: Date } | null;
  cashSettledAt: Date | null;
  cashSettledByName: string | null;
  /** True when this viewer may see the GPS fields of the job (never for supervisors' own / each other's, see canViewGps). */
  gpsVisible: boolean;
  /** Office may close / verify this job. */
  needsClosure: boolean;
};

/** Today's jobs plus anything still On the way / In progress from earlier days, newest activity first. */
export async function getFieldOps(viewer: { role: string; staffId?: string | null }, now = new Date()): Promise<FieldOpsRow[]> {
  const { from, to } = istDayRange(now);
  const jobs = await db.job.findMany({
    where: {
      deletedAt: null,
      isDemo: false,
      status: { notIn: ["CANCELLED", "POSTPONED"] },
      OR: [{ scheduledDate: { gte: from, lt: to } }, { status: { in: ["ON_THE_WAY", "STARTED"] } }],
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
    take: 200,
    select: {
      id: true, jobNumber: true, customerName: true, area: true, service: true, scheduledTime: true, status: true, jobValue: true,
      reachedAt: true, reachedLat: true, reachedLng: true, reachedAccuracyM: true, reachedDistanceM: true, gpsFlag: true,
      startOtp: true, startOtpAttempts: true, startOtpVerifiedAt: true, startedAt: true, completedAt: true,
      collectedAmount: true, collectedMode: true, pendingReason: true, cashCollectedByName: true, cashCollectedAt: true, cashSettledAt: true, cashSettledByName: true,
      assignments: { select: { isLead: true, staff: { select: { id: true, name: true, designation: true, user: { select: { role: true } } } } } },
    },
  });
  return jobs.map((j) => {
    // The check-in belongs to whoever is on the job: if any assignee is one the viewer may not see, hide the GPS of the whole job.
    const gpsVisible = j.assignments.every((a) => canViewGps(viewer, { staffId: a.staff.id, type: gpsSubjectOf({ designation: a.staff.designation, userRole: a.staff.user?.role }) }));
    return {
    id: j.id,
    jobNumber: j.jobNumber,
    customerName: j.customerName,
    area: j.area,
    service: j.service,
    scheduledTime: j.scheduledTime,
    status: j.status,
    stage: fieldStage({ status: j.status, reachedAt: j.reachedAt, startOtpVerifiedAt: j.startOtpVerifiedAt }),
    team: j.assignments.map((a) => ({ name: a.staff.name, isLead: a.isLead })),
    reachedAt: j.reachedAt,
    gpsFlag: gpsVisible ? j.gpsFlag : null,
    reachedDistanceM: gpsVisible ? j.reachedDistanceM : null,
    reachedAccuracyM: gpsVisible ? j.reachedAccuracyM : null,
    mapHref: gpsVisible && j.reachedLat != null && j.reachedLng != null ? `https://maps.google.com/?q=${j.reachedLat.toFixed(5)},${j.reachedLng.toFixed(5)}` : null,
    // The code is shown to the office as the customer-side backup; it is cleared from view once work has started.
    startOtp: j.startOtpVerifiedAt || j.status === "COMPLETED" ? null : j.startOtp,
    startOtpAttempts: j.startOtpAttempts,
    otpVerifiedAt: j.startOtpVerifiedAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    billed: j.jobValue,
    collectedAmount: j.collectedAmount,
    collectedMode: j.collectedMode,
    pendingReason: j.pendingReason,
    cashWithStaff: j.collectedMode === "CASH" && j.cashCollectedAt && !j.cashSettledAt ? { name: j.cashCollectedByName ?? "staff", amount: j.collectedAmount ?? 0, at: j.cashCollectedAt } : null,
    cashSettledAt: j.cashSettledAt,
    cashSettledByName: j.cashSettledByName,
    gpsVisible,
    needsClosure: j.status !== "COMPLETED" ? j.status === "STARTED" || j.status === "ON_THE_WAY" : j.collectedMode === "PENDING_APPROVAL",
    };
  });
}
