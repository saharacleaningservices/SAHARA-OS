import { Badge } from "@/components/ui/badge";
import {
  LEAD_STAGE_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  STAFF_AVAILABILITY_LABELS,
  ATTENDANCE_STATUS_LABELS,
} from "@/lib/constants";

const LEAD_STAGE_VARIANT: Record<string, "muted" | "info" | "warning" | "success" | "default" | "secondary"> = {
  NEW: "muted",
  INTERESTED: "info",
  SITE_VISIT: "info",
  QUOTATION: "info",
  NEGOTIATION: "warning",
  CONFIRMED: "default",
  JOB_SCHEDULED: "default",
  COMPLETED: "success",
};

const JOB_STATUS_VARIANT: Record<string, "muted" | "info" | "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  ASSIGNED: "muted",
  ON_THE_WAY: "info",
  STARTED: "warning",
  COMPLETED: "success",
  POSTPONED: "muted",
  CANCELLED: "destructive",
  REACTIVATED: "info",
};

const PAYMENT_STATUS_VARIANT: Record<string, "muted" | "warning" | "destructive" | "success"> = {
  PENDING: "muted",
  DUE_SOON: "warning",
  OVERDUE: "destructive",
  PAID: "success",
};

const AVAILABILITY_VARIANT: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  AVAILABLE: "success",
  ON_JOB: "warning",
  ON_LEAVE: "muted",
  OFF_DUTY: "destructive",
};

const ATTENDANCE_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  PRESENT: "success",
  HALF_DAY: "warning",
  ABSENT: "destructive",
  LEAVE: "muted",
  WEEKLY_OFF: "muted",
};

export function LeadStageBadge({ stage }: { stage: string }) {
  return <Badge variant={LEAD_STAGE_VARIANT[stage] ?? "muted"}>{LEAD_STAGE_LABELS[stage] ?? stage}</Badge>;
}

export function JobStatusBadge({ status }: { status: string }) {
  return <Badge variant={JOB_STATUS_VARIANT[status] ?? "muted"}>{JOB_STATUS_LABELS[status] ?? status}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge variant={PAYMENT_STATUS_VARIANT[status] ?? "muted"}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function AvailabilityBadge({ status }: { status: string }) {
  return <Badge variant={AVAILABILITY_VARIANT[status] ?? "muted"}>{STAFF_AVAILABILITY_LABELS[status] ?? status}</Badge>;
}

export function AttendanceBadge({ status }: { status: string }) {
  return <Badge variant={ATTENDANCE_VARIANT[status] ?? "muted"}>{ATTENDANCE_STATUS_LABELS[status] ?? status}</Badge>;
}
