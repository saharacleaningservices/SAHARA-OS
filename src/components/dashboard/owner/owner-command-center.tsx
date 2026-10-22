import Link from "next/link";
import {
  BellRing,
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
  FileStack,
  Target,
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
import { DashboardModules } from "@/components/dashboard/dashboard-modules";
import { HeroStats } from "@/components/dashboard/hero-stats";
import { BookingQrCard } from "@/components/dashboard/booking-qr-card";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { CollapsibleList, ListRow } from "@/components/dashboard/tabbed-dashboard";
import { StatusPill } from "@/components/shared/status-pill";
import { getSlotBoard } from "@/server/actions/slot-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR, formatCompactINR, formatDate } from "@/lib/utils";
import { getInvoiceStatusSummary } from "@/server/dashboard-extras";

/** Collapsible dashboard section — secondary content stays one tap away. */
function Fold({ title, badge, open = false, children }: { title: ReactNode; badge?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border bg-card text-card-foreground shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
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
 * Owner Command Center — the ADMIN + ACCOUNTS home dashboard, split into the
 * /dashboard tabs (hero + Inquiries / Operations / Finance). Fetches once;
 * everything reads from real data (getOwnerCommandCenterHome, getOwnerSnapshot,
 * getCompanySettings, getDashboardData); nothing is fabricated. showProfit
 * controls the Net Profit / Bank Balance tiles — false for Accounts, since
 * Profit stays owner-only. showBusinessTarget hides the Monthly Business
 * Target tile for Accounts only. Never call this for OPERATIONS: it carries money.
 */
export async function getOwnerDashboardSections({
  role,
  ownerName,
  showProfit,
  showBusinessTarget = true,
  inquiryTools,
}: {
  role: string;
  ownerName: string;
  showProfit: boolean;
  showBusinessTarget?: boolean;
  /** Quick Add + inquiry tracker etc., shown at the top of the Inquiries tab. */
  inquiryTools?: ReactNode;
}) {
  const [home, snapshot, settings, dashboard, board, invoices] = await Promise.all([
    getOwnerCommandCenterHome(),
    getOwnerSnapshot(),
    getCompanySettings(),
    getDashboardData(),
    getSlotBoard(1),
    getInvoiceStatusSummary(),
  ]);

  const { today, businessTarget, revenue, staffList, vehicleList, alerts, calendar, followUpsToday, siteVisitsToday } =
    home;

  const chips = [
    { href: "/jobs?when=today", label: "jobs today", count: today.totalJobs },
    { href: "/leads?due=today", label: "follow-ups", count: followUpsToday.length },
    { href: "/leads?stage=SITE_VISIT", label: "site visits", count: siteVisitsToday.length },
    { href: "/payments?filter=pending", label: "overdue payments", count: alerts.overduePayments.length },
  ];
  // Shoyab's (ACCOUNTS) primary view is finance (owner 2026-10-22): team-assignment and capacity chips are owner-only.
  if (role !== "ACCOUNTS") {
    chips.push({ href: "/jobs?when=today", label: "jobs without staff", count: alerts.unassignedJobsToday.length });
    // Team capacity today (same numbers as Slot Availability).
    const todaySlot = board?.[0];
    if (todaySlot) chips.push({ href: "/jobs/slots", label: `teams · ${todaySlot.booked}/${todaySlot.dailyCapacity} booked today`, count: todaySlot.teams });
  }
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

  const hero = <HeroStats greeting={getGreeting()} name={ownerName} chips={chips} />;

  const inquiries = (
    <>
      {inquiryTools}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <CollapsibleList
          title="Follow-ups Today"
          icon={<BellRing className="size-4 text-primary" />}
          href="/leads?due=today"
          empty="No follow-ups due today."
          items={followUpsToday.map((f) => (
            <ListRow key={f.id} href={`/leads/${f.lead.id}`} left={f.lead.name} right={<span className="capitalize">{f.type.replace("_", " ").toLowerCase()} · {f.lead.area}</span>} />
          ))}
        />
        <CollapsibleList
          title="Site Visits Today"
          icon={<MapPin className="size-4 text-indigo-600" />}
          href="/leads?stage=SITE_VISIT"
          empty="No site visits today."
          items={siteVisitsToday.map((l) => <ListRow key={l.id} href={`/leads/${l.id}`} left={l.name} right={l.timeSlot ?? l.area} />)}
        />
        <CollapsibleList
          title="Stale Leads (5+ days)"
          icon={<Clock className="size-4 text-warning" />}
          href="/leads"
          empty="No stale leads."
          items={alerts.staleLeads.map((l) => <ListRow key={l.id} href={`/leads/${l.id}`} left={l.name} right={formatDate(l.updatedAt)} />)}
        />
      </div>

      {/* Google Reviews — honest: real owner-set values, or an honest
          "not available yet" placeholder. Never fabricated. */}
      <Fold
        title={<><Star className="size-4 text-amber-500" /> Google Reviews</>}
        badge={settings.googleRating ? <span className="text-xs font-semibold">{settings.googleRating}★</span> : undefined}
      >
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
      </Fold>
    </>
  );

  const operations = (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <DashboardModules role={role} />
        <BookingQrCard url={`${PUBLIC_BOOKING_URL}/booking`} />
        <Fold
          open={alerts.unassignedJobsToday.length > 0}
          title="Quick Dispatch"
          badge={<span className="text-xs text-muted-foreground">{dashboard.todaysJobs.length} job{dashboard.todaysJobs.length === 1 ? "" : "s"} today</span>}
        >
          <QuickDispatch jobs={dashboard.todaysJobs} staffList={staffList} vehicleList={vehicleList} />
        </Fold>
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-3">
          <CollapsibleList
            title="No Staff Today"
            icon={<UserX className="size-4 text-destructive" />}
            href="/jobs?when=today"
            empty="Every job today has staff."
            items={alerts.unassignedJobsToday.map((j) => <ListRow key={j.id} href={`/jobs/${j.id}`} left={j.customerName} right={j.scheduledTime} />)}
          />
          <CollapsibleList
            title="Cancelled · 3 days"
            icon={<XCircle className="size-4 text-destructive" />}
            href="/jobs"
            empty="No cancellations."
            items={alerts.cancelledJobs.map((j) => <ListRow key={j.id} href={`/jobs/${j.id}`} left={j.customerName} right={formatDate(j.scheduledDate)} />)}
          />
          <CollapsibleList
            title="Postponed · 3 days"
            icon={<PauseCircle className="size-4 text-warning" />}
            href="/jobs"
            empty="No postponements."
            items={alerts.postponedJobs.map((j) => <ListRow key={j.id} href={`/jobs/${j.id}`} left={j.customerName} right={formatDate(j.scheduledDate)} />)}
          />
        </div>
      </div>
      <section id="schedule" className="scroll-mt-32 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Calendar</h2>
          <Link href="/jobs/slots" className="text-xs font-medium text-primary">Slot Availability →</Link>
        </div>
        <LeadMonthCalendar initialYear={calendar.year} initialMonth={calendar.month} initialDays={calendar.days} initialLeadsByDay={calendar.leadsByDay} compact />
      </section>
    </div>
  );

  const invoiceTile = (label: string, v: { count: number; amount: number }, tone: string) => (
    <Link href="/invoices" className="rounded-lg border border-border p-3 hover:border-primary/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{v.count}</p>
      <p className="text-[11px] text-muted-foreground">{formatCompactINR(v.amount)}</p>
    </Link>
  );
  const targetSet = businessTarget.targetAmount != null && businessTarget.targetAmount > 0;

  // Finance tab (owner 2026-10-22): Cash Flow first, then what needs collecting, then invoices. Cards with nothing to
  // show are left out (no overdue list when none are overdue); an unset business target folds away.
  const finance = (
    <>
      {/* Cash Flow */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="size-4 text-primary" /> Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <div className="col-span-2 rounded-lg border border-border p-3 sm:col-span-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Collection rate</span>
              <span className="font-medium text-foreground">{collectionPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${collectionPercent}%` }} />
            </div>
          </div>
          {showProfit && snapshot.bankBalance != null && (
            <div className="col-span-2 rounded-lg border border-border p-3 sm:col-span-4">
              <p className="text-xs text-muted-foreground">Bank Balance</p>
              <p className="text-lg font-semibold text-foreground">{formatINR(snapshot.bankBalance)}</p>
            </div>
          )}
        </CardContent>
      </Card>
      {alerts.overduePayments.length > 0 && (
        <CollapsibleList
          title="Overdue Payments"
          icon={<Wallet className="size-4 text-destructive" />}
          href="/payments?filter=pending"
          items={alerts.overduePayments.map((p) => (
            <ListRow key={p.id} left={p.clientName} right={<StatusPill tone="bad">{formatINR(p.outstanding)}</StatusPill>} />
          ))}
        />
      )}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileStack className="size-4 text-primary" /> Invoice Status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {invoiceTile("Issued (unpaid)", invoices.issued, "text-warning")}
          {invoiceTile("Partially paid", invoices.partiallyPaid, "text-warning")}
          {invoiceTile("Paid", invoices.paid, "text-success")}
          {invoiceTile("Draft", invoices.draft, "text-foreground")}
        </CardContent>
      </Card>
      {showBusinessTarget &&
        (targetSet ? (
          <BusinessTargetCard businessTarget={businessTarget} />
        ) : (
          <Fold title={<><Target className="size-4 text-primary" /> Set monthly business target</>}>
            <BusinessTargetCard businessTarget={businessTarget} />
          </Fold>
        ))}
      <RevenueIntelligence
        revenue={{
          monthlyRevenue: revenue.monthlyRevenue,
          balancePending: revenue.balancePending,
          advanceCollectedToday: revenue.advanceCollectedToday,
          todaysCollection: revenue.todaysCollection,
        }}
        overduePayments={alerts.overduePayments}
      />
      <Fold title={<><BarChart3 className="size-4 text-primary" /> Service Performance</>}>
        <div className="space-y-2.5">
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
        </div>
      </Fold>
    </>
  );

  return { hero, inquiries, operations, finance };
}
