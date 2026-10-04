import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const STATUS_STYLE: Record<string, { label: string; short: string; cls: string; dot: string }> = {
  PRESENT: { label: "Present", short: "P", cls: "bg-success text-white", dot: "bg-success" },
  HALF_DAY: { label: "Half Day", short: "H", cls: "bg-warning text-white", dot: "bg-warning" },
  ABSENT: { label: "Absent", short: "A", cls: "bg-destructive text-white", dot: "bg-destructive" },
  LEAVE: { label: "Leave", short: "L", cls: "bg-violet-600 text-white", dot: "bg-violet-600" },
  WEEKLY_OFF: { label: "Weekly Off", short: "WO", cls: "bg-slate-400 text-white dark:bg-slate-600", dot: "bg-slate-400" },
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  ON_THE_WAY: "On the way",
  STARTED: "Started",
  COMPLETED: "Completed",
  POSTPONED: "Postponed",
  CANCELLED: "Cancelled",
  REACTIVATED: "Reactivated",
};

export function StatusChip({ status, className }: { status: string | null; className?: string }) {
  if (!status) return <span className={cn("rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground", className)}>Not marked</span>;
  const s = STATUS_STYLE[status];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s?.cls, className)}>{s?.label ?? status}</span>;
}

export function Section({ title, action, children, id, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" | "warn" | "primary" }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-warning",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
