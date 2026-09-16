import Link from "next/link";
import {
  ClipboardList,
  CalendarClock,
  Users,
  BellRing,
  CheckCircle2,
  UserX,
  Clock,
  Wallet,
  BarChart3,
  PiggyBank,
  Star,
} from "lucide-react";
import { getOwnerCommandCenterHome } from "@/server/owner-command-center";
import { getOwnerSnapshot } from "@/server/owner";
import { getCompanySettings } from "@/server/settings";
import { getDashboardData } from "@/server/dashboard";
import { ExpandableCard } from "./expandable-card";
import { LeadMonthCalendar } from "./lead-calendar";
import { BusinessTargetCard } from "./business-target-card";
import { RevenueIntelligence } from "./revenue-intelligence";
import { QuickDispatch } from "./quick-dispatch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/utils";

type DayData = {
  totalJobs: number;
  categories: { service: string; label: string; count: number }[];
  followUps: number;
  siteVisits: number;
  collectionCount: number;
  collectionAmount: number;
};

function dayCardBody(data: DayData) {
  return (
    <div className="space-y-3 pt-3">
      <div className="space-y-1.5">
        {data.categories.map((c) => (
          <div key={c.service} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{c.label}</span>
            <span className="font-medium text-foreground">{c.count}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">{data.followUps}</p>
          <p className="text-[10px] text-muted-foreground">Follow-ups</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{data.siteVisits}</p>
          <p className="text-[10px] text-muted-foreground">Site Visits</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{formatINR(data.collectionAmount)}</p>
          <p className="text-[10px] text-muted-foreground">Collected ({data.collectionCount})</p>
        </div>
      </div>
    </div>
  );
}

/**
    * Owner Command Center — the ADMIN + ACCOUNTS home dashboard. Everything
 * here reads from real data (getOwnerCommandCenterHome, getOwnerSnapshot,
 * getCompanySettings, getDashboardData); nothing is fabricated. showProfit
 * controls the Net Profit / Bank Balance tiles below — false for Accounts,
 * since Profit stays owner-only.
 */
export async function OwnerCommandCenter({
  ownerName,
  showProfit,
}: {
  ownerName: string;
  showProfit: boolean;
}) {
  const [home, snapshot, settings, dashboard] = await Promise.all([
    getOwnerCommandCenterHome(),
    getOwnerSnapshot(),
    getCompanySettings(),
    getDashboardData(),
  ]);

  const { today, tomorrow, totalLeadsCount, businessTarget, revenue, staffList, vehicleList, alerts, calendar } =
    home;

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
    <div className="space-y-6">
      {/* Header — literal "Good Morning" greeting per the build spec, not
          time-of-day aware. A deliberate simplification; swap in a small
          getGreeting() helper later if the owner wants it to adapt through
          the day. */}
      <div className="sahara-gradient rounded-xl p-5 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-white/70">Owner Command Center</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Good Morning, {ownerName}</h1>
        <p className="mt-1 text-sm text-white/80">
          {today.totalJobs} job{today.totalJobs === 1 ? "" : "s"} today · {today.followUps} follow-up
          {today.followUps === 1 ? "" : "s"} · {today.siteVisits} site visit{today.siteVisits === 1 ? "" : "s"}
        </p>
      </div>

      {/* Four click-to-expand hero cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExpandableCard
          trigger={
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ClipboardList className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Today&apos;s Jobs</p>
                <p className="text-xs text-muted-foreground">{today.totalJobs} scheduled</p>
              </div>
            </div>
          }
        >
          {dayCardBody(today)}
        </ExpandableCard>

        <ExpandableCard
          trigger={
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600">
                <CalendarClock className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Tomorrow&apos;s Jobs</p>
                <p className="text-xs text-muted-foreground">{tomorrow.totalJobs} scheduled</p>
              </div>
            </div>
          }
        >
          {dayCardBody(tomorrow)}
        </ExpandableCard>

        <ExpandableCard
          trigger={
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Total Leads</p>
                <p className="text-xs text-muted-foreground">{totalLeadsCount} in pipeline</p>
              </div>
            </div>
          }
        >
          <div className="pt-3">
            <LeadMonthCalendar
              initialYear={calendar.year}
              initialMonth={calendar.month}
              initialDays={calendar.days}
              initialLeadsByDay={calendar.leadsByDay}
            />
          </div>
        </ExpandableCard>

        <BusinessTargetCard businessTarget={businessTarget} />
      </div>

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
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-primary" /> Owner Alert Center
          </CardTitle>
          {alerts.totalCount > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
              {alerts.totalCount} need{alerts.totalCount === 1 ? "s" : ""} attention
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {alerts.totalCount === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> All clear — nothing needs your attention right now.
            </div>
          ) : (
            <>
              {alerts.overduePayments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Wallet className="size-3.5 text-destructive" /> Overdue Payments (
                    {alerts.overduePayments.length})
                  </p>
                  {alerts.overduePayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{p.clientName}</span>
                      <span className="shrink-0 font-medium text-destructive">{formatINR(p.outstanding)}</span>
                    </div>
                  ))}
                </div>
              )}
              {alerts.staleLeads.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Clock className="size-3.5 text-warning" /> Stale Leads — no update in 5+ days (
                    {alerts.staleLeads.length})
                  </p>
                  {alerts.staleLeads.map((l) => (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{l.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(l.updatedAt)}</span>
                    </Link>
                  ))}
                </div>
              )}
              {alerts.unassignedJobsToday.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserX className="size-3.5 text-destructive" /> Jobs Today With No Staff (
                    {alerts.unassignedJobsToday.length})
                  </p>
                  {alerts.unassignedJobsToday.map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40"
                    >
                      <span className="truncate text-foreground">{j.customerName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{j.scheduledTime}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Dispatch</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickDispatch jobs={dashboard.todaysJobs} staffList={staffList} vehicleList={vehicleList} />
        </CardContent>
      </Card>

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

      {/* Google Reviews — honest: real owner-set values, or an honest
          "not available yet" placeholder. Never fabricated. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-amber-500" /> Google Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
