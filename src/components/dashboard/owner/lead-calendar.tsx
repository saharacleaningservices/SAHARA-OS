"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadStageBadge } from "@/components/shared/status-badge";
import { fetchLeadMonthCalendar } from "@/server/actions/owner-dashboard";
import { toTelLink, cn } from "@/lib/utils";

type CalendarLead = { id: string; name: string; mobile: string; stage: string };
type DayColor = "green" | "blue" | "orange" | "red" | "white";
type CalendarDay = { day: number; iso: string; weekday: number; count: number; color: DayColor };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const COLOR_DOT: Record<DayColor, string> = {
  green: "bg-success",
  blue: "bg-primary",
  orange: "bg-warning",
  red: "bg-destructive",
  white: "bg-muted-foreground/40",
};

const COLOR_CELL: Record<DayColor, string> = {
  green: "bg-success/15 border-success/30",
  blue: "bg-primary/10 border-primary/30",
  orange: "bg-warning/15 border-warning/40",
  red: "bg-destructive/15 border-destructive/30",
  white: "bg-card border-border",
};

export function LeadMonthCalendar({
  initialYear,
  initialMonth,
  initialDays,
  initialLeadsByDay,
}: {
  initialYear: number;
  initialMonth: number;
  initialDays: CalendarDay[];
  initialLeadsByDay: Record<string, CalendarLead[]>;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState(initialDays);
  const [leadsByDay, setLeadsByDay] = useState(initialLeadsByDay);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(y: number, m: number) {
    startTransition(async () => {
      const data = await fetchLeadMonthCalendar(y, m);
      setYear(data.year);
      setMonth(data.month);
      setDays(data.days as CalendarDay[]);
      setLeadsByDay(data.leadsByDay as Record<string, CalendarLead[]>);
    });
  }
  const prev = () => (month === 1 ? go(year - 1, 12) : go(year, month - 1));
  const next = () => (month === 12 ? go(year + 1, 1) : go(year, month + 1));

  const leading = days.length ? days[0].weekday : 0;
  const selectedLeads = selectedDay ? leadsByDay[selectedDay] ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {MONTHS[month - 1]} {year}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-7" onClick={prev} disabled={pending}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-7" onClick={next} disabled={pending}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-center py-1 text-[10px] font-semibold uppercase text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`x${i}`} />
        ))}
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            disabled={pending || d.count === 0}
            onClick={() => setSelectedDay(d.iso)}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border text-xs transition-colors",
              COLOR_CELL[d.color],
              d.count > 0 && "cursor-pointer hover:border-primary/50",
            )}
          >
            <span className="font-medium text-foreground">{d.day}</span>
            {d.count > 0 && <span className="text-[9px] text-muted-foreground">{d.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <i className={cn("size-2 rounded-full", COLOR_DOT.green)} /> Confirmed / Job
        </span>
        <span className="flex items-center gap-1">
          <i className={cn("size-2 rounded-full", COLOR_DOT.blue)} /> Site Visit
        </span>
        <span className="flex items-center gap-1">
          <i className={cn("size-2 rounded-full", COLOR_DOT.orange)} /> Follow-up
        </span>
        <span className="flex items-center gap-1">
          <i className={cn("size-2 rounded-full", COLOR_DOT.red)} /> Cancelled
        </span>
        <span className="flex items-center gap-1">
          <i className={cn("size-2 rounded-full", COLOR_DOT.white)} /> New / None
        </span>
        {pending && <Loader2 className="size-3 animate-spin" />}
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? new Date(selectedDay).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {selectedLeads.length === 0 && (
              <p className="text-sm text-muted-foreground">No leads this day.</p>
            )}
            {selectedLeads.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.mobile}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <LeadStageBadge stage={l.stage} />
                  <Button asChild variant="outline" size="icon" className="size-7">
                    <a href={toTelLink(l.mobile)} title="Call">
                      <Phone className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
