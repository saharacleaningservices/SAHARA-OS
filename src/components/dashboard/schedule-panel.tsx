"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export type ScheduleDay = {
  date: string;
  booked: number;
  teams: number;
  dailyCapacity: number;
  /** What customers see. */
  status: "OPEN" | "FILLING" | "FULL";
  /** Office setting for the day: AUTO = calculated. */
  control: "AUTO" | "OPEN" | "FILLING" | "FULL";
  slots: { slot: string; available: boolean }[];
};
type DayJob = { id: string; customerName: string; scheduledTime: string; area: string; status: string; teamNumber: number | null };

const TONE = { OPEN: "bg-emerald-500", FILLING: "bg-amber-500", FULL: "bg-red-500" } as const;
const BADGE = { OPEN: "bg-emerald-100 text-emerald-800", FILLING: "bg-amber-100 text-amber-800", FULL: "bg-red-100 text-red-700" } as const;
const LABEL = { OPEN: "Open", FILLING: "Filling", FULL: "Fully booked" } as const;
const day = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { ...o, timeZone: "Asia/Kolkata" });

/**
 * Dashboard schedule — the central control view. A strip of the next days
 * (customer status dot per day); the selected day shows jobs, teams, slot
 * availability and the Open / Filling / Fully booked / Auto status. Changing
 * availability stays on the Slot Availability page (not duplicated here).
 */
export function SchedulePanel({ days, jobs, monthView }: { days: ScheduleDay[]; jobs: Record<string, DayJob[]>; monthView?: ReactNode }) {
  const [sel, setSel] = useState(0);
  const d = days[sel];
  if (!d) return null;
  const list = jobs[d.date];
  const when = sel === 0 ? "today" : sel === 1 ? "tomorrow" : null;

  return (
    <section id="schedule" className="scroll-mt-20 rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Schedule</h2>
        <Link href="/jobs/slots" className="text-xs font-medium text-primary">Slot Availability →</Link>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10" role="tablist" aria-label="Choose a date">
        {days.map((x, i) => (
          <button
            key={x.date}
            type="button"
            role="tab"
            aria-selected={i === sel}
            onClick={() => setSel(i)}
            className={cn("flex flex-col items-center rounded-lg border py-1.5 text-[11px] leading-tight", i === sel ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/40")}
          >
            <span className="text-muted-foreground">{i === 0 ? "Today" : day(x.date, { weekday: "short" })}</span>
            <span className="text-sm font-bold">{day(x.date, { day: "numeric" })}</span>
            <span className={cn("mt-0.5 size-1.5 rounded-full", TONE[x.status])} />
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{day(d.date, { weekday: "long", day: "numeric", month: "short" })}</p>
          <span className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", BADGE[d.status])}>{LABEL[d.status]}</span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{d.control === "AUTO" ? "Auto" : "Set by office"}</span>
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x rounded-lg border text-center">
          <div className="py-1.5"><p className="text-[10px] uppercase text-muted-foreground">Jobs</p><p className="text-sm font-bold">{d.booked}</p></div>
          <div className="py-1.5"><p className="text-[10px] uppercase text-muted-foreground">Teams</p><p className="text-sm font-bold">{d.teams}</p></div>
          <div className="py-1.5"><p className="text-[10px] uppercase text-muted-foreground">Day capacity</p><p className="text-sm font-bold">{d.booked}/{d.dailyCapacity}</p></div>
        </div>
        {d.slots.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.slots.map((s) => (
              <span key={s.slot} className={cn("rounded-full border px-2 py-0.5 text-[11px]", s.available ? "border-emerald-300 text-emerald-800" : "border-red-300 bg-red-50 text-red-700 line-through")}>
                {s.slot}
              </span>
            ))}
          </div>
        )}
        {list && (
          <div className="space-y-1.5">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs scheduled.</p>
            ) : (
              list.slice(0, 6).map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm hover:border-primary/40">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.customerName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{j.scheduledTime} · {j.area}{j.teamNumber ? ` · T${j.teamNumber}` : " · no team"}</span>
                  </span>
                  <JobStatusBadge status={j.status} />
                </Link>
              ))
            )}
          </div>
        )}
        {when && (
          <Link href={`/jobs?when=${when}`} className="block text-right text-xs font-medium text-primary">
            All {when}&apos;s jobs →
          </Link>
        )}
      </div>

      {monthView && (
        <details className="group mt-3 border-t pt-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-muted-foreground">
            Month view (enquiries & bookings)
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-2">{monthView}</div>
        </details>
      )}
    </section>
  );
}
