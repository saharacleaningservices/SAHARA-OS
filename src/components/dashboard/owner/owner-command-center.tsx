import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  UserX,
  Clock,
  Wallet,
  BarChart3,
  PiggyBank,
  Star,
  XCircle,
  PauseCircle,
  MapPin,
  ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";
import { getOwnerCommandCenterHome } from "@/server/owner-command-center";
import { getOwnerSnapshot } from "@/server/owner";
import { getCompanySettings } from "@/server/settings";
import { getDashboardData } from "@/server/dashboard";
import { LeadMonthCalendar } from "./lead-calendar";
import { BusinessTargetCard } from "./business-target-card";
import { RevenueIntelligence } from "./revenue-intelligence";
import { QuickDispatch } from "./quick-dispatch";
import { DashboardModules, DashboardQuickBar } from "@/components/dashboard/dashboard-modules";
import { getSlotBoard } from "@/server/actions/slot-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";

/** Collapsible dashboard section — keeps the home screen to 1–2 scrolls on a phone. */
function Fold({ title, badge, open = false, children }: { title: ReactNode; badge?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border bg-card text-card-foreground">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

const CAP = 5;
function More({ count, href }: { count: number; href: string }) {
  return count > CAP ? (
    <Link href={href} className="block text-right text-xs font-medium text-primary">
      +{count - CAP} more →
    </Link>
  ) : null;
}

// Always India time — the server itself may run in UTC.
function getGreeting(date: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(date),
  );
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
    * Owner Command Center — the ADMIN + ACCOUNTS home dashboard. Everything
 * here reads from real data (getOwnerCommandCenterHome, getOwnerSnapshot,
 * getCompanySettings, getDashboardData); nothing is fabricated. showProfit
 * controls the Net Profit / Bank Balance tiles below — false for Accounts,
 * since Profit stays owner-only. showBusinessTarget hides the Monthly
 * Business Target tile for Accounts only — every other card is identical.
 */
export async function OwnerCommandCenter({
  role,
  ownerName,
  showProfit,
  showBusinessTarget = true,
}: {
  role: string;
  ownerName: string;
  showProfit: boolean;
  showBusinessTarget?: boolean;
}) {
  const [home, snapshot, settings, dashboard, board] = await Promise.all([
    getOwnerCommandCenterHome(),
    getOwnerSnapshot(),
    getCompanySettings(),
    getDashboardData(),
    getSlotBoard(1),
  ]);

  const { today, businessTarget, revenue, staffList, vehicleList, alerts, calendar, followUpsToday, siteVisitsToday } =
    home;
  const attentionCount = alerts.totalCount + followUpsToday.length + siteVisitsToday.length;

  const chips = [
    { href: "/jobs?when=today", label: "jobs today", count: today.totalJobs },
    { href: "/leads?due=today", label: "follow-ups", count: followUpsToday.length },
    { href: "/leads?stage=SITE_VISIT", label: "site visits", count: siteVisitsToday.length },
    { href: "/payments?filter=pending", label: "overdue payments", count: alerts.overduePayments.length },
    { href: "/jobs?when=today", label: "jobs without staff", count: alerts.unassignedJobsToday.length },
  ];
  // Schedule: what customers see per day (same rule as Slot Availability) + the office setting.
  // Team capacity today (same numbers as Slot Availability).
  const todaySlot = board?.[0];
  if (todaySlot) chips.push({ href: "/jobs/slots", label: `teams · ${todaySlot.booked}/${todaySlot.dailyCapacity} booked today`, count: todaySlot.teams });
  const collectionPercent =
    snapshot.collected + snapshot.pendingCollections > 0
      ? Math.round((snapshot.collected / (snapshot.collected + snapshot.pendingCollections)) * 100)
      : 0;

  let featuredReviews: { name: string; text: string; rating: number }[] = [];
  if (settings.featuredReviews) {
    try {
      featuredReviews = JSON.parse(settings.featuredReviews);
    } catch {
      featuredReviews = [];
    }
  }

  return (
    <div className="space-y-4">
      <div className="sahara-gradient rounded-xl p-4 text-white sm:p-5">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">{getGreeting()}, {ownerName}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.count > 0 ? "bg-white text-foreground" : "bg-white/15 text-white/80"}`}
            >
              <span className="font-bold">{c.count}</span> {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Control center: quick actions + six groups | compact calendar (side by side on desktop) */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <DashboardQuickBar role={role} />
          <DashboardModules role={role} />
        </div>
        <section id="schedule" className="scroll-mt-20 rounded-xl border bg-card p-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Calendar</h2>
            <Link href="/jobs/slots" className="text-xs font-medium text-primary">Slot Availability →</Link>
          </div>
          <LeadMonthCalendar initialYear={calendar.year} initialMonth={calendar.month} initialDays={calendar.days} initialLeadsByDay={calendar.leadsByDay} compact />
        </section>
      </div>

      {/* Analytics & alerts stay one tap away, not on the main view. */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
          Business overview <span className="text-xs font-normal text-muted-foreground">target · revenue · alerts · dispatch · reviews</span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-3 pb-3">
      {showBusinessTarget && <BusinessTargetCard businessTarget={businessTarget} />}

      {/* Revenue Intelligence */}
      <RevenueIntelligence
        revenue={{
          monthlyRevenue: revenue.monthlyRevenue,
          balancePending: revenue.balancePending,
          advanceCollectedToday: revenue.advanceCollectedToday,
          todaysCollection: revenue.todaysCollection,
        }}
        overduePayments={alerts.overduePayments}
      />

      {/* Owner Alert Center — always visible, real signals only */}
      <Fold
        open={attentionCount > 0}
        title={<><BellRing className="size-4 text-primary" /> Owner Alert Center</>}
        badge={
          attentionCount > 0 ? (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
              {attentionCount} need{attentionCount === 1 ? "s" : ""} attention
            </span>
          ) : (
            <span className="text-xs font-medium text-success">All clear</span>
          )
        }
      >
        <div className="space-y-4">
          {attentionCount === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> All clear — nothing needs your attention right now.
            </div>
          ) : (
            <>
              {followUpsToday.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <BellRing className="size-3.5 text-primary" /> Follow-ups Today ({followUpsToday.length})
                  </p>
                  {followUpsToday.slice(0, CAP).map((f) => (
                    <Link
                      key={f.id}
                      href={`/leads/${f.lead.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{f.lead.name}</span>
                      <span className="shrink-0 text-xs capitalize text-muted-foreground">
                        {f.type.replace("_", " ").toLowerCase()} · {f.lead.area}
                      </span>
                    </Link>
                  ))}
                  <More count={followUpsToday.length} href="/leads?due=today" />
                </div>
              )}
              {siteVisitsToday.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <MapPin className="size-3.5 text-indigo-600" /> Site Visits Today ({siteVisitsToday.length})
                  </p>
                  {siteVisitsToday.slice(0, CAP).map((l) => (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{l.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{l.timeSlot ?? l.area}</span>
                    </Link>
                  ))}
                  <More count={siteVisitsToday.length} href="/leads?stage=SITE_VISIT" />
                </div>
              )}
              {alerts.overduePayments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Wallet className="size-3.5 text-destructive" /> Overdue Payments (
                    {alerts.overduePayments.length})
                  </p>
                  {alerts.overduePayments.slice(0, CAP).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{p.clientName}</span>
                      <span className="shrink-0 font-medium text-destructive">{formatINR(p.outstanding)}</span>
                    </div>
                  ))}
                  <More count={alerts.overduePayments.length} href="/payments?filter=pending" />
                </div>
              )}
              {alerts.staleLeads.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Clock className="size-3.5 text-warning" /> Stale Leads — no update in 5+ days (
                    {alerts.staleLeads.length})
                  </p>
                  {alerts.staleLeads.slice(0, CAP).map((l) => (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{l.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(l.updatedAt)}</span>
                    </Link>
                  ))}
                  <More count={alerts.staleLeads.length} href="/leads" />
                </div>
              )}
              {alerts.unassignedJobsToday.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserX className="size-3.5 text-destructive" /> Jobs Today With No Staff (
                    {alerts.unassignedJobsToday.length})
                  </p>
                  {alerts.unassignedJobsToday.slice(0, CAP).map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{j.customerName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{j.scheduledTime}</span>
                    </Link>
                  ))}
                  <More count={alerts.unassignedJobsToday.length} href="/jobs?when=today" />
                </div>
              )}
              {alerts.cancelledJobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <XCircle className="size-3.5 text-destructive" /> Cancelled Jobs — last 3 days (
                    {alerts.cancelledJobs.length})
                  </p>
                  {alerts.cancelledJobs.slice(0, CAP).map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{j.customerName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(j.scheduledDate)}</span>
                    </Link>
                  ))}
                  <More count={alerts.cancelledJobs.length} href="/jobs" />
                </div>
              )}
              {alerts.postponedJobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <PauseCircle className="size-3.5 text-warning" /> Postponed Jobs — last 3 days (
                    {alerts.postponedJobs.length})
                  </p>
                  {alerts.postponedJobs.slice(0, CAP).map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{j.customerName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(j.scheduledDate)}</span>
                    </Link>
                  ))}
                  <More count={alerts.postponedJobs.length} href="/jobs" />
                </div>
              )}
            </>
          )}
        </div>
      </Fold>

      {/* Quick Dispatch */}
      <Fold
        open={alerts.unassignedJobsToday.length > 0}
        title="Quick Dispatch"
        badge={<span className="text-xs text-muted-foreground">{dashboard.todaysJobs.length} job{dashboard.todaysJobs.length === 1 ? "" : "s"} today</span>}
      >
        <QuickDispatch jobs={dashboard.todaysJobs} staffList={staffList} vehicleList={vehicleList} />
      </Fold>

      <Fold title={<><BarChart3 className="size-4 text-primary" /> Service performance &amp; cash flow</>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Service Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Service Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {snapshot.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed jobs this month yet.</p>
            ) : (
              snapshot.topServices.map((s) => {
                const max = Math.max(...snapshot.topServices.map((x) => x.revenue), 1);
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{s.label}</span>
                      <span className="text-muted-foreground">
                        {formatINR(s.revenue)} · {s.jobs} jobs
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(s.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="size-4 text-primary" /> Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Collected (month)</p>
              <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.collected)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Expenses (month)</p>
              <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.expenses)}</p>
            </div>
            {showProfit && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.netProfit)}</p>
              </div>
            )}
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Pending Collections</p>
              <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.pendingCollections)}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Collection rate</span>
                <span className="font-medium text-foreground">{collectionPercent}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${collectionPercent}%` }} />
              </div>
            </div>
            {showProfit && snapshot.bankBalance != null && (
              <div className="col-span-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Bank Balance</p>
                <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.bankBalance)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </Fold>

      {/* Google Reviews — honest: real owner-set values, or an honest
          "not available yet" placeholder. Never fabricated. */}
      <Fold
        title={<><Star className="size-4 text-amber-500" /> Google Reviews</>}
        badge={settings.googleRating ? <span className="text-xs font-semibold">{settings.googleRating}★</span> : undefined}
      >
        <div>
          {settings.googleReviewUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{settings.googleRating ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{settings.googleReviewCount ?? "0"} reviews</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer">
                    View on Google
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Rating and count are owner-set values from Settings — not live-synced with Google.
              </p>
              {featuredReviews.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {featuredReviews.slice(0, 3).map((r, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-foreground">{r.name}</p>
                      <p className="text-xs text-amber-500">{"★".repeat(Math.max(0, Math.min(5, r.rating)))}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not available yet — no Google review link is configured. Add one in Settings to show live rating and
              review count here.
            </p>
          )}
        </div>
      </Fold>
        </div>
      </details>
    </div>
  );
}
