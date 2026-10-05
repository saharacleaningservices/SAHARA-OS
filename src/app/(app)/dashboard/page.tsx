import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  MapPin,
  ClipboardList,
  CalendarClock,
  CalendarRange,
  Wallet,
  TrendingUp,
  PiggyBank,
  UserCheck,
  HardHat,
  Truck,
  ShieldCheck,
  Star,
  BellRing,
  ArrowRight,
  Percent,
  CalendarCheck,
} from "lucide-react";
import { getDashboardData } from "@/server/dashboard";
import { getNewLeadsForDashboard } from "@/server/leads";
import { NewLeadsCard } from "@/components/dashboard/new-leads-card";
import { getLeadSourceStats } from "@/server/owner";
import { getLeadMonthCalendar, type CalendarDetailLevel } from "@/server/owner-command-center";
import { jobDateWindowForRole } from "@/server/jobs";
import { LeadMonthCalendar } from "@/components/dashboard/owner/lead-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStageBadge, JobStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { FollowUpBoard } from "@/components/dashboard/followup-board";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { UpcomingJobsTable } from "@/components/dashboard/upcoming-jobs-table";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS, canAccess } from "@/lib/constants";
import { requireUser } from "@/lib/current-user";
import { canViewRevenue, canViewFinancials } from "@/lib/permissions";

import { OwnerCommandCenter } from "@/components/dashboard/owner/owner-command-center";

export default async function DashboardPage() {
  const session = await requireUser();
  // Field staff use the mobile Staff App, not the office dashboard.
  if (session.role === "STAFF") redirect("/my");

  if (session.role === "ADMIN" || session.role === "ACCOUNTS") {
    return (
    <OwnerCommandCenter
      ownerName={session.name.split(" ")[0]}
      showProfit={session.role === "ADMIN"}
      showBusinessTarget={session.role === "ADMIN"}
    />
  );
  }
  // Calendar widget, now shown to every role (owner instruction
  // 2026-09-21). Detail level is decided from the session's real role here,
  // server-side — Operations (Shoyab) gets day status-counts only,
  // Supervisor (Francis) gets a per-lead list without phone numbers.
  const now = new Date();
  const calendarDetailLevel: CalendarDetailLevel = session.role === "SUPERVISOR" ? "supervisor" : "counts";

  const [
    {
      stats,
      recentLeads,
      todaysJobs,
      upcomingJobs,
      overduePayments,
      followUpsToday,
      followUpsTomorrow,
      followUpsOverdue,
      recentReviews,
    },
    sourceStats,
    calendar,
    newLeads,
  ] = await Promise.all([
    getDashboardData(session.role, session.sub),
    getLeadSourceStats(3),
    // Francis (OPERATIONS): the calendar only counts yesterday / today / tomorrow.
    getLeadMonthCalendar(now.getFullYear(), now.getMonth() + 1, calendarDetailLevel, jobDateWindowForRole(session.role === "OPERATIONS" ? "OPERATIONS" : "ADMIN")),
    // Francis (OPERATIONS): New Leads + Create New Lead, owner request 2026-10-05.
    session.role === "OPERATIONS" ? getNewLeadsForDashboard(session.sub) : Promise.resolve(null),
  ]);

  const firstName = session.name.split(" ")[0];
  const showRevenue = canViewRevenue(session.role);
  const showProfit = canViewFinancials(session.role);
  const showFleetCards = canAccess(session.role, "vehicles");
  const showAmcCard = canAccess(session.role, "amc");
  // Field roles (Field Coordinator / Field Staff) get a today/tomorrow
  // operations-only dashboard — no CRM, staff or reports cards, since those
  // sections are hidden from them entirely.
  const showCrm = canAccess(session.role, "leads");
  const showStaffCards = canAccess(session.role, "staff");
  const showReportsCards = canAccess(session.role, "reports");
  const upcomingFollowUpsCount = followUpsToday.length + followUpsTomorrow.length;
  // Field-restricted roles (SUPERVISOR and, since Francis moved to
  // OPERATIONS on 2026-09-25, OPERATIONS too) must not see global/historical
  // business metrics (Total Leads, Monthly Leads, Monthly Jobs, Conversion
  // Rate, Repeat Customers, Overdue Follow-ups) — only "today + tomorrow
  // actionable" information. OPERATIONS also has "leads" removed from
  // ROLE_NAV_ACCESS entirely now (see constants.ts), so showCrm is already
  // false for it; isFieldRestricted additionally narrows the few cards
  // (e.g. Monthly Jobs) that aren't gated by showCrm at all.
  const isFieldRestricted = session.role === "SUPERVISOR" || session.role === "OPERATIONS";
  const showCrmGlobalStats = showCrm && !isFieldRestricted;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening at Sahara Cleaning Services today."
      />

      {newLeads && <NewLeadsCard rows={newLeads.rows} newCount={newLeads.newCount} />}

      {/* Sahara CRM Dashboard Redesign — Phase 1: the four numbers the
          office checks first, above everything else. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          href="/jobs?when=today"
          label="Today's Jobs"
          value={stats.todaysJobsCount}
          icon={<ClipboardList className="size-4" />}
          tone="primary"
          glow={stats.todaysJobsCount > 0}
        />
        {showRevenue && (
          <StatCard
            href="/payments?filter=pending"
            label="Pending Collection"
            value={formatINR(stats.pendingPaymentsTotal)}
            icon={<Wallet className="size-4" />}
            tone="orange"
            glow={stats.pendingPaymentsTotal > 0}
          />
        )}
        {showCrm && (
          <StatCard
            href="/leads?due=today"
            label="Today's Leads"
            value={stats.todaysLeadsCount}
            icon={<Users className="size-4" />}
            tone="blue"
          />
        )}
        {showCrm && (
          <StatCard
            href="/leads?stage=SITE_VISIT"
            label="Site Visits Today"
            value={stats.siteVisitsToday}
            icon={<MapPin className="size-4" />}
            tone="indigo"
            glow={stats.siteVisitsToday > 0}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Operational quick actions + KPIs ─────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <DashboardQuickActions showPayments={!isFieldRestricted} showNewLead={showCrm} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {showCrmGlobalStats && (
              <StatCard href="/leads" label="Total Leads" value={stats.totalLeadsCount} icon={<Users className="size-4" />} tone="blue" />
            )}
            {showCrm && (
              <StatCard href="/leads?due=today" label="Today's Leads" value={stats.todaysLeadsCount} icon={<Users className="size-4" />} tone="blue" />
            )}
            {showCrmGlobalStats && (
              <StatCard href="/leads" label="Monthly Leads" value={stats.monthlyLeadsCount} icon={<CalendarRange className="size-4" />} tone="blue" />
            )}
            {session.role === "OPERATIONS" && (
              <StatCard href="/jobs?when=yesterday" label="Yesterday's Jobs" value={stats.yesterdaysJobsCount} icon={<ClipboardList className="size-4" />} tone="blue" />
            )}
            <StatCard href="/jobs?when=today" label="Today's Jobs" value={stats.todaysJobsCount} icon={<ClipboardList className="size-4" />} tone="blue" glow={stats.todaysJobsCount > 0} />
            <StatCard href="/jobs?when=tomorrow" label="Tomorrow's Jobs" value={stats.tomorrowsJobsCount} icon={<CalendarClock className="size-4" />} tone="blue" />
            {!isFieldRestricted && (
              <StatCard href="/jobs" label="Monthly Jobs" value={stats.monthlyBookingsCount} icon={<CalendarRange className="size-4" />} tone="blue" />
            )}
            {showCrm && (
              <StatCard href="/leads?stage=SITE_VISIT" label="Site Visits Today" value={stats.siteVisitsToday} icon={<MapPin className="size-4" />} tone="indigo" glow={stats.siteVisitsToday > 0} />
            )}
            {showCrmGlobalStats && (
              <StatCard href="/customers" label="Repeat Customers" value={stats.repeatCustomerCount} icon={<Users className="size-4" />} tone="purple" />
            )}
            {showCrmGlobalStats && (
              <StatCard
                href="/leads"
                label="Conversion Rate"
                value={`${stats.conversionRate}%`}
                trendLabel={`${stats.convertedLeadsCount} of ${stats.totalLeadsCount} leads`}
                icon={<Percent className="size-4" />}
                tone="teal"
              />
            )}
            {showCrm && (
              <StatCard
                href="/leads?due=today"
                label="Upcoming Follow-ups"
                value={upcomingFollowUpsCount}
                trendLabel="Today + tomorrow"
                icon={<CalendarCheck className="size-4" />}
                tone="blue"
              />
            )}
            {showRevenue && (
              <>
                <StatCard href="/payments?filter=today" label="Today's Revenue" value={formatINR(stats.revenueToday)} icon={<TrendingUp className="size-4" />} tone="green" />
                <StatCard href="/revenue" label="Monthly Revenue" value={formatINR(stats.monthlyRevenue)} trend={stats.revenueTrend} trendLabel={`${stats.collectionRate}% collected`} icon={<Wallet className="size-4" />} tone="green" />
                <StatCard href="/payments?filter=pending" label="Pending Collection" value={formatINR(stats.pendingPaymentsTotal)} icon={<Wallet className="size-4" />} tone="orange" glow={stats.pendingPaymentsTotal > 0} />
              </>
            )}
            {showReportsCards && (
              <StatCard href="/reports" label="Review Pending" value={stats.reviewsPendingCount} icon={<Star className="size-4" />} tone="orange" />
            )}
            {/* Overdue = historical by definition (dueDate before today) —
                hidden for SUPERVISOR; the query itself also returns empty
                for him (server/dashboard.ts), this is belt-and-suspenders. */}
            {showCrm && !isFieldRestricted && (
              <StatCard href="/leads?due=overdue" label="Overdue Follow-ups" value={followUpsOverdue.length} icon={<BellRing className="size-4" />} tone="red" glow={followUpsOverdue.length > 0} />
            )}
            {showStaffCards && (
              <>
                <StatCard href="/staff" label="Team On Job" value={stats.staffOnJobCount} icon={<HardHat className="size-4" />} tone="purple" />
                <StatCard href="/staff" label="Staff Available" value={stats.staffAvailableCount} icon={<UserCheck className="size-4" />} tone="teal" />
              </>
            )}
            {showFleetCards && (
              <>
                <StatCard href="/vehicles" label="Vehicle Available" value={stats.vehiclesActiveCount} icon={<Truck className="size-4" />} tone="indigo" />
                <StatCard
                  href="/vehicles"
                  label="Vehicles In Use"
                  value={stats.vehiclesInUseCount}
                  trendLabel={`${Math.max(stats.vehiclesActiveCount - stats.vehiclesInUseCount, 0)} available today`}
                  icon={<Truck className="size-4" />}
                  tone="gold"
                />
              </>
            )}
            {showAmcCard && (
              <StatCard href="/amc" label="Upcoming AMC" value={stats.upcomingAmcCount} icon={<ShieldCheck className="size-4" />} tone="gold" />
            )}
            {showProfit && (
              <StatCard href="/profit" label="Net Profit (month)" value={formatINR(stats.netProfit)} trend={stats.profitTrend} icon={<PiggyBank className="size-4" />} tone="green" />
            )}
          </div>
        </div>

        {/* ── Today's Action panel ───────────────────────────── */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today&apos;s Action</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href="/jobs?when=today" className={`rounded-lg border p-3 hover:border-primary/50 ${stats.todaysJobsCount > 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <p className="text-xs text-muted-foreground">Today&apos;s Jobs</p>
                <p className="text-xl font-semibold text-foreground">{stats.todaysJobsCount}</p>
              </Link>
              {showRevenue && (
                <Link href="/payments?filter=pending" className={`rounded-lg border p-3 hover:border-primary/50 ${stats.pendingPaymentsTotal > 0 ? "border-warning/40 bg-warning/5" : "border-border"}`}>
                  <p className="text-xs text-muted-foreground">Pending Collection</p>
                  <p className="text-xl font-semibold text-foreground">{formatINR(stats.pendingPaymentsTotal)}</p>
                </Link>
              )}
              {showReportsCards && (
                <Link href="/reports" className={`rounded-lg border p-3 hover:border-primary/50 ${stats.reviewsPendingCount > 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <p className="text-xs text-muted-foreground">Review Requests</p>
                  <p className="text-xl font-semibold text-foreground">{stats.reviewsPendingCount}</p>
                </Link>
              )}
              {showStaffCards ? (
                <Link href="/staff" className="rounded-lg border border-border p-3 hover:border-primary/50">
                  <p className="text-xs text-muted-foreground">Staff On Job</p>
                  <p className="text-xl font-semibold text-foreground">{stats.staffOnJobCount}</p>
                </Link>
              ) : (
                <Link href="/jobs/dispatch" className="rounded-lg border border-border p-3 hover:border-primary/50">
                  <p className="text-xs text-muted-foreground">Team Dispatch</p>
                  <p className="text-xl font-semibold text-foreground">Route</p>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadMonthCalendar
                initialYear={calendar.year}
                initialMonth={calendar.month}
                initialDays={calendar.days}
                initialLeadsByDay={calendar.leadsByDay}
                detailLevel={calendarDetailLevel}
              />
            </CardContent>
          </Card>

          {showCrm && followUpsOverdue.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center justify-between py-3">
                <p className="text-sm font-medium text-destructive">🔴 {followUpsOverdue.length} overdue follow-up{followUpsOverdue.length > 1 ? "s" : ""}</p>
                <Button asChild size="sm" variant="outline"><Link href="/leads?due=overdue">Open</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <UpcomingJobsTable jobs={upcomingJobs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {showCrm && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent Leads</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/leads">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentLeads.length === 0 ? (
                <EmptyState title="No leads yet" description="New leads will show up here." />
              ) : (
                recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {SERVICE_LABELS[lead.service]} · {lead.area}
                      </p>
                    </div>
                    <LeadStageBadge stage={lead.stage} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Today&apos;s Jobs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {todaysJobs.length === 0 ? (
              <EmptyState title="No jobs scheduled today" description="Jobs scheduled for today will appear here." />
            ) : (
              todaysJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{job.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.scheduledTime} · {job.supervisor?.name ?? "Unassigned"} · {job.area}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {showRevenue && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Overdue Payments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/payments">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {overduePayments.length === 0 ? (
                <EmptyState title="Nothing overdue" description="All payments are on track." />
              ) : (
                overduePayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.clientName}</p>
                      <p className="truncate text-xs text-destructive">
                        {p.invoiceNumber} · Due {formatDate(p.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{formatINR(p.amount - p.paidAmount)}</span>
                      {p.clientMobile && (
                        <>
                          <CallButton mobile={p.clientMobile} />
                          <WhatsAppButton
                            mobile={p.clientMobile}
                            message={`Hi ${p.clientName}, this is a reminder from Sahara Cleaning Services — invoice ${p.invoiceNumber} of ${formatINR(p.amount - p.paidAmount)} is overdue. Kindly clear at your earliest convenience.`}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {showCrm && (
          <FollowUpBoard today={followUpsToday} tomorrow={followUpsTomorrow} overdue={followUpsOverdue} />
        )}

        {showReportsCards && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentReviews.length === 0 ? (
                <EmptyState title="No reviews yet" description="Customer reviews will show up here once captured." />
              ) : (
                recentReviews.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{r.customerName ?? r.customerMobile}</p>
                      {r.comment && <p className="truncate text-xs text-muted-foreground">{r.comment}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-amber-500">{"★".repeat(Math.max(0, Math.min(5, r.rating)))}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showRevenue && sourceStats.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Lead Sources — last 3 months</CardTitle>
            <Link href="/revenue" className="text-xs font-medium text-primary">Full analytics →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {sourceStats.slice(0, 6).map((s) => {
              const max = Math.max(...sourceStats.map((x) => x.leads), 1);
              return (
                <div key={s.source}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-muted-foreground">{s.leads} leads · {s.conversion}% converted</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(s.leads / max) * 100}%` }} />
                </div>
              </div>
            );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
