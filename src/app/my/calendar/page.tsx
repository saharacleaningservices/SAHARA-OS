import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getMyMonth, getMyYear } from "@/server/staff-portal";
import { Section, Stat, STATUS_STYLE, MONTHS, WEEKDAYS } from "@/components/staff-app/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
      {Object.entries(STATUS_STYLE).map(([k, s]) => (
        <span key={k} className="flex items-center gap-1">
          <span className={cn("size-2.5 rounded-full", s.dot)} /> {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full border-2 border-primary" /> Job assigned
      </span>
      <span className="flex items-center gap-1">
        <span className="font-bold text-primary">₹</span> Advance / fine / reward
      </span>
    </div>
  );
}

export default async function StaffCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; year?: string; month?: string }> }) {
  const { staff } = await requireMyStaff();
  if (!staff) return null;
  const sp = await searchParams;
  const now = new Date();
  const view = sp.view === "year" ? "year" : "month";
  const year = Math.min(Math.max(Number(sp.year) || now.getFullYear(), 2020), 2100);
  const month = Math.min(Math.max(Number(sp.month) || now.getMonth() + 1, 1), 12);

  const tabs = (
    <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
      {(["month", "year"] as const).map((v) => (
        <Link
          key={v}
          href={`/my/calendar?view=${v}&year=${year}&month=${month}`}
          className={cn("flex min-h-10 items-center justify-center rounded-lg", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
        >
          {v === "month" ? "Month" : "Year"}
        </Link>
      ))}
    </div>
  );

  if (view === "year") {
    const { months } = await getMyYear(staff.id, year);
    const totals = months.reduce(
      (t, m) => ({ present: t.present + m.present, half: t.half + m.halfDay, absent: t.absent + m.absent, leave: t.leave + m.leave, off: t.off + m.weeklyOff, jobs: t.jobs + m.jobs }),
      { present: 0, half: 0, absent: 0, leave: 0, off: 0, jobs: 0 },
    );
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">My Calendar</h1>
        {tabs}
        <div className="flex items-center justify-between">
          <Link href={`/my/calendar?view=year&year=${year - 1}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous year">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="text-lg font-semibold">{year}</div>
          <Link href={`/my/calendar?view=year&year=${year + 1}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next year">
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Present" value={totals.present} tone="good" />
          <Stat label="Half day" value={totals.half} tone="warn" />
          <Stat label="Absent" value={totals.absent} tone="bad" />
          <Stat label="Leave" value={totals.leave} />
          <Stat label="Weekly off" value={totals.off} />
          <Stat label="Job days" value={totals.jobs} tone="primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {months.map((m) => (
            <Link key={m.month} href={`/my/calendar?view=month&year=${year}&month=${m.month}`} className="rounded-2xl border border-border bg-card p-2.5 shadow-sm">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold">{MONTHS[m.month - 1]}</span>
                <span className="text-[10px] text-muted-foreground">
                  P {m.present + m.halfDay * 0.5} · A {m.absent}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {Array.from({ length: m.firstWeekday }).map((_, i) => (
                  <span key={`b${i}`} />
                ))}
                {m.days.map((d) => (
                  <span
                    key={d.iso}
                    className={cn(
                      "aspect-square rounded-[3px]",
                      d.status ? STATUS_STYLE[d.status]?.dot : "bg-muted",
                      d.hasJob && !d.status && "ring-1 ring-inset ring-primary",
                    )}
                    title={d.iso}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>
        <Legend />
      </div>
    );
  }

  const { days, totals } = await getMyMonth(staff.id, year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My Calendar</h1>
      {tabs}
      <Section>
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/my/calendar?year=${prev.y}&month=${prev.m}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous month">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="text-base font-semibold">{new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
          <Link href={`/my/calendar?year=${next.y}&month=${next.m}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next month">
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const s = d.status ? STATUS_STYLE[d.status] : null;
            const money = d.hasAdvance || d.hasFine || d.hasReward;
            return (
              <Link
                key={d.iso}
                href={`/my/day/${d.iso}`}
                aria-label={`${d.iso}${s ? `, ${s.label}` : ""}${d.jobCount ? `, ${d.jobCount} job` : ""}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold transition-transform active:scale-95",
                  s ? s.cls : "bg-muted/60 text-foreground",
                  d.jobCount > 0 && !s && "ring-2 ring-inset ring-primary",
                  d.jobCount > 0 && s && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  d.isToday && "outline outline-2 outline-offset-2 outline-foreground",
                )}
              >
                {d.day}
                {s && <span className="text-[9px] font-bold leading-none opacity-90">{s.short}</span>}
                {money && <span className={cn("absolute right-0.5 top-0 text-[10px] font-bold", s ? "text-white" : "text-primary")}>₹</span>}
              </Link>
            );
          })}
        </div>
        <div className="mt-3">
          <Legend />
        </div>
      </Section>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Present" value={totals.present} tone="good" />
        <Stat label="Half day" value={totals.halfDay} tone="warn" />
        <Stat label="Absent" value={totals.absent} tone="bad" />
        <Stat label="Leave" value={totals.leave} />
        <Stat label="Weekly off" value={totals.weeklyOff} />
        <Stat label="Jobs" value={totals.jobs} tone="primary" />
      </div>
      <p className="text-center text-xs text-muted-foreground">Tap any date to see attendance, site, team, advance, fine and reward details.</p>
    </div>
  );
}
