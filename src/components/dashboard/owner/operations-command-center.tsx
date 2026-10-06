import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, CalendarDays, CalendarRange, ClipboardList, HardHat, History, Route, ShieldCheck, Truck, UserCheck, UserPlus, Users } from "lucide-react";
import { getOperationsHome } from "@/server/owner-command-center";
import { getDashboardData } from "@/server/dashboard";
import { ExpandableCard } from "./expandable-card";
import { LeadMonthCalendar } from "./lead-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/shared/status-badge";

type OpsDay = Awaited<ReturnType<typeof getOperationsHome>>["today"];

function getGreeting(date: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(date));
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Day card body — same as the Super Admin card, without any money figure. */
function dayBody(data: OpsDay, when: "yesterday" | "today" | "tomorrow") {
  return (
    <div className="space-y-3 pt-3">
      {data.jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs scheduled.</p>
      ) : (
        <div className="space-y-1.5">
          {data.jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40">
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{j.customerName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {j.scheduledTime} · {j.area}
                  {j.teamNumber ? ` · T${j.teamNumber}` : ""}
                </span>
              </span>
              <JobStatusBadge status={j.status} />
            </Link>
          ))}
        </div>
      )}
      <Link href={`/jobs?when=${when}`} className="block text-center text-xs font-medium text-primary">
        Open {when}&apos;s job list →
      </Link>
      <div className="space-y-1.5 border-t border-border pt-3">
        {data.categories.map((c) => (
          <div key={c.service} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{c.label}</span>
            <span className="font-medium text-foreground">{c.count}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">{data.followUps}</p>
          <p className="text-[10px] text-muted-foreground">Follow-ups</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{data.siteVisits}</p>
          <p className="text-[10px] text-muted-foreground">Site Visits</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Operations Manager (Francis) home — Super Admin layout, Operations data:
 * Today / Tomorrow jobs, Total / Monthly leads and the booking calendar for
 * yesterday → tomorrow (same canonical calendar as Super Admin). Never shows
 * profit, margin, salary, loan, staff cost, revenue or payment totals.
 */
export async function OperationsCommandCenter({ name, userId, newLeads }: { name: string; userId: string; newLeads?: ReactNode }) {
  const [{ yesterday, today, tomorrow, totalLeadsCount, todaysLeadsCount, calendar }, { stats }] = await Promise.all([
    getOperationsHome(),
    // Team / vehicle / AMC counts he already uses today (counts only — no money is rendered from this).
    getDashboardData("OPERATIONS", userId),
  ]);

  const tile = (icon: ReactNode, tint: string, label: string, value: number, sub: string) => (
    <div className="flex items-center gap-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight text-foreground">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
  const chips = [
    { href: "/jobs?when=yesterday", label: "jobs yesterday", count: yesterday.totalJobs },
    { href: "/jobs?when=today", label: "jobs today", count: today.totalJobs },
    { href: "/jobs?when=tomorrow", label: "jobs tomorrow", count: tomorrow.totalJobs },
    { href: "/leads?due=today", label: "follow-ups", count: today.followUps },
    { href: "/leads?stage=SITE_VISIT", label: "site visits", count: today.siteVisits },
  ];

  return (
    <div className="space-y-6">
      <div className="sahara-gradient rounded-xl p-4 text-white sm:p-5">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">
          {getGreeting()}, {name}
        </h1>
        <p className="mt-0.5 text-xs text-white/80">Operations · yesterday, today &amp; tomorrow</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link key={c.label} href={c.href} className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.count > 0 ? "bg-white text-foreground" : "bg-white/15 text-white/80"}`}>
              <span className="font-bold">{c.count}</span> {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExpandableCard trigger={tile(<ClipboardList className="size-5" />, "bg-primary/15 text-primary", "Today's Jobs", today.totalJobs, "Tap for the full list")}>{dayBody(today, "today")}</ExpandableCard>
        <ExpandableCard trigger={tile(<CalendarClock className="size-5" />, "bg-indigo-500/15 text-indigo-600", "Tomorrow's Jobs", tomorrow.totalJobs, "Tap for the full list")}>{dayBody(tomorrow, "tomorrow")}</ExpandableCard>
        {/* Both lead tiles open the Booking Calendar below (owner rule 2026-10-06). */}
        <a href="#booking-calendar" className="rounded-xl border border-border bg-card p-4 hover:border-primary/40">
          {tile(<CalendarRange className="size-5" />, "bg-teal-500/15 text-teal-600", "Today Leads", todaysLeadsCount, "Tap for the booking calendar")}
        </a>
        <a href="#booking-calendar" className="rounded-xl border border-border bg-card p-4 hover:border-primary/40">
          {tile(<Users className="size-5" />, "bg-blue-500/15 text-blue-600", "Total Leads", totalLeadsCount, "Tap for the booking calendar")}
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card id="booking-calendar" className="scroll-mt-20 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" /> Booking Calendar
              <span className="text-xs font-normal text-muted-foreground">· customer phone shown for yesterday, today &amp; tomorrow</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadMonthCalendar
              initialYear={calendar.year}
              initialMonth={calendar.month}
              initialDays={calendar.days}
              initialLeadsByDay={calendar.leadsByDay}
              detailLevel="operations"
            />
          </CardContent>
        </Card>
        <div className="space-y-3">
          <ExpandableCard trigger={tile(<History className="size-5" />, "bg-muted text-muted-foreground", "Yesterday's Jobs", yesterday.totalJobs, "Tap for the full list")}>{dayBody(yesterday, "yesterday")}</ExpandableCard>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Team &amp; vehicles</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["/staff", "Staff available", stats.staffAvailableCount, <UserCheck key="i" className="size-4 text-teal-600" />],
                  ["/staff", "Team on job", stats.staffOnJobCount, <HardHat key="i" className="size-4 text-purple-600" />],
                  ["/vehicles", "Vehicles available", Math.max(stats.vehiclesActiveCount - stats.vehiclesInUseCount, 0), <Truck key="i" className="size-4 text-indigo-600" />],
                  ["/amc", "Upcoming AMC", stats.upcomingAmcCount, <ShieldCheck key="i" className="size-4 text-amber-600" />],
                ] as const
              ).map(([href, label, value, icon]) => (
                <Link key={label} href={href} className="rounded-lg border border-border px-3 py-2 hover:border-primary/40">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {icon} {label}
                  </span>
                  <span className="text-lg font-semibold text-foreground">{value}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["/leads/new", "New Lead", <UserPlus key="i" className="size-4" />],
                  ["/jobs", "Jobs", <ClipboardList key="i" className="size-4" />],
                  ["/jobs/dispatch", "Team Dispatch", <Route key="i" className="size-4" />],
                  ["/attendance", "Attendance", <UserCheck key="i" className="size-4" />],
                ] as const
              ).map(([href, label, icon]) => (
                <Link key={href} href={href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-medium hover:border-primary/40">
                  {icon} {label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {newLeads}
    </div>
  );
}
