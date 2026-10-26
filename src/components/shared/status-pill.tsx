import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared by the CRM dashboard and the Staff App (/my). No "use client" — renders on the server,
// so the staff home ships no extra JS for it.

// Soft background + dark text (≥4.5:1 at 12px); lighter text on tinted bg in dark mode.
const PILL = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
} as const;
export type PillTone = keyof typeof PILL;

/** High-contrast status pill, e.g. <StatusPill tone="warn">Shoyab pending</StatusPill>. */
export function StatusPill({ tone = "muted", icon, title, className, children }: { tone?: PillTone; icon?: ReactNode; title?: string; className?: string; children: ReactNode }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/**
 * "Francis saw it" / "Shoyab pending" — colour by the recipient's role, so the two people
 * read apart at a glance: Operations green/amber, everyone else (Accounts) blue/orange.
 */
export function seenTone(role: string, seen: boolean): PillTone {
  if (role === "OPERATIONS") return seen ? "good" : "warn";
  return seen ? "info" : "orange";
}

/** Job status → tone; same meaning as JobStatusBadge in the CRM. */
export const JOB_STATUS_TONE: Record<string, PillTone> = {
  PENDING: "warn",
  ASSIGNED: "muted",
  ON_THE_WAY: "info",
  STARTED: "warn",
  COMPLETED: "good",
  POSTPONED: "muted",
  CANCELLED: "bad",
  REACTIVATED: "info",
};
