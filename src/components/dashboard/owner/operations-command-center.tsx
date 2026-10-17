import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, CalendarRange, ClipboardList, HardHat, History, ShieldCheck, Truck, UserCheck } from "lucide-react";
import { getOperationsHome } from "@/server/owner-command-center";
import { getDashboardData } from "@/server/dashboard";
import { ExpandableCard } from "./expandable-card";
import { LeadMonthCalendar } from "./lead-calendar";
import { getSlotBoard } from "@/server/actions/slot-control";
import { DashboardModules } from "@/components/dashboard/dashboard-modules";
import { HeroStats } from "@/components/dashboard/hero-stats";
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
export async function getOperationsDashboardSections({ name, userId, newLeads }: { name: string; userId: string; newLeads?: ReactNode }) {
  const [{ yesterday, today, tomorrow, totalLeadsCount, todaysLeadsCount, calendar }, { stats }, board] = await Promise.all([
    getOperationsHome(),
    // Team / vehicle / AMC counts he already uses today (counts only — no money is rendered from this).
    getDashboardData("OPERATIONS", userId),
    getSlotBoard(1),
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
  // Same summary as the Super Admin dashboard, operational counts only (no payments/money).
  const chips = [
    { href: "/jobs?when=today", label: "jobs today", count: today.totalJobs },
    { href: "/jobs?when=tomorrow", label: "jobs tomorrow", count: tomorrow.totalJobs },
    { href: "/leads?due=today", label: "follow-ups", count: today.followUps },
    { href: "/leads?stage=SITE_VISIT", label: "site visits", count: today.siteVisits },
    { href: "/jobs?when=today", label: "jobs without team", count: today.jobs.filter((j) => !j.teamNumber).length },
  ];
  const todaySlot = board?.[0];
  if (todaySlot) chips.push({ href: "/jobs/slots", label: `teams · ${todaySlot.booked}/${todaySlot.dailyCapacity} booked today`, count: todaySlot.teams });

  const hero = <HeroStats greeting={getGreeting()} name={name} chips={chips} />;

  const countLink = (href: string, label: string, value: number, icon: ReactNode) => (
    <Link key={label} href={href} className="rounded-2xl border border-border bg-card px-3 py-2 shadow-sm hover:border-primary/40">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
    </Link>
  );

  // Inquiries tab: his scoped new leads + today's lead counts (no customer phone, no money).
  const inquiries = (
    <>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {countLink("/leads", "Leads today", todaysLeadsCount, <CalendarRange className="size-4 text-teal-600" />)}
        {countLink("/leads", "Leads total", totalLeadsCount, <ClipboardList className="size-4 text-primary" />)}
        {countLink("/leads?due=today", "Follow-ups today", today.followUps, <CalendarClock className="size-4 text-indigo-600" />)}
        {countLink("/leads?stage=SITE_VISIT", "Site visits today", today.siteVisits, <UserCheck className="size-4 text-amber-600" />)}
      </div>
      {newLeads}
    </>
  );

  const operations = (
    <>
      {/* Control center: quick actions + six groups (role-filtered) | compact calendar */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <DashboardModules role="OPERATIONS" />
        </div>
        <section id="schedule" className="scroll-mt-32 rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Calendar</h2>
            <Link href="/jobs/slots" className="text-xs font-medium text-primary">Slot Availability →</Link>
          </div>
          <LeadMonthCalendar
            initialYear={calendar.year}
            initialMonth={calendar.month}
            initialDays={calendar.days}
            initialLeadsByDay={calendar.leadsByDay}
            detailLevel="operations"
            compact
          />
        </section>
      </div>

      {/* Day lists — each card expands in place to its job list. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ExpandableCard trigger={tile(<ClipboardList className="size-5" />, "bg-primary/15 text-primary", "Today's Jobs", today.totalJobs, "Tap for the full list")}>{dayBody(today, "today")}</ExpandableCard>
        <ExpandableCard trigger={tile(<CalendarClock className="size-5" />, "bg-indigo-500/15 text-indigo-600", "Tomorrow's Jobs", tomorrow.totalJobs, "Tap for the full list")}>{dayBody(tomorrow, "tomorrow")}</ExpandableCard>
        <ExpandableCard trigger={tile(<History className="size-5" />, "bg-muted text-muted-foreground", "Yesterday's Jobs", yesterday.totalJobs, "Tap for the full list")}>{dayBody(yesterday, "yesterday")}</ExpandableCard>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {countLink("/staff", "Staff available", stats.staffAvailableCount, <UserCheck className="size-4 text-teal-600" />)}
        {countLink("/staff", "Team on job", stats.staffOnJobCount, <HardHat className="size-4 text-purple-600" />)}
        {countLink("/vehicles", "Vehicles available", Math.max(stats.vehiclesActiveCount - stats.vehiclesInUseCount, 0), <Truck className="size-4 text-indigo-600" />)}
        {countLink("/amc", "Upcoming AMC", stats.upcomingAmcCount, <ShieldCheck className="size-4 text-amber-600" />)}
      </div>
    </>
  );

  // No finance section — Francis never receives money data.
  return { hero, inquiries, operations };
}
