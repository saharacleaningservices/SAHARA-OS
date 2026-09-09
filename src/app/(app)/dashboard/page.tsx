import Link from "next/link";
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
} from "lucide-react";
import { getDashboardData } from "@/server/dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStageBadge, JobStatusBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { FollowUpBoard } from "@/components/dashboard/followup-board";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS, canAccess } from "@/lib/constants";
import { requireUser } from "@/lib/current-user";
import { canViewRevenue, canViewFinancials } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await requireUser();
  const {
    stats,
    recentLeads,
    todaysJobs,
    overduePayments,
    followUpsToday,
    followUpsTomorrow,
    followUpsOverdue,
  } = await getDashboardData();

  const firstName = session.name.split(" ")[0];
  const showRevenue = canViewRevenue(session.role);
  const showProfit = canViewFinancials(session.role);
  const showBackOffice = session.role === "ADMIN" || session.role === "OPERATIONS";
  // Field roles (Field Coordinator / Field Staff) get a today/tomorrow
  // operations-only dashboard — no CRM, staff or reports cards, since those
  // sections are hidden from them entirely.
  const showCrm = canAccess(session.role, "leads");
  const showStaffCards = canAccess(session.role, "staff");
  const showReportsCards = canAccess(session.role, "reports");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening at Sahara Cleaning Services today."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Operational quick actions + KPIs ─────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <DashboardQuickActions />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {showCrm && (
              <>
                <StatCard href="/leads" label="Total Leads" value={stats.totalLeadsCount} icon={<Users className="size-4" />} tone="blue" />
                <StatCard href="/leads?due=today" label="Today's Leads" value={stats.todaysLeadsCount} icon={<Users className="size-4" />} tone="blue" />
                <StatCard href="/leads" label="Monthly Leads" value={stats.monthlyLeadsCount} icon={<CalendarRange className="size-4" />} tone="blue" />
              </>
            )}
            <StatCard href="/jobs?when=today" label="Today's Jobs" value={stats.todaysJobsCount} icon={<ClipboardList className="size-4" />} tone="blue" glow={stats.todaysJobsCount > 0} />
            <StatCard href="/jobs?when=tomorrow" label="Tomorrow's Jobs" value={stats.tomorrowsJobsCount} icon={<CalendarClock className="size-4" />} tone="blue" />
            <StatCard href="/jobs" label="Monthly Jobs" value={stats.monthlyBookingsCount} icon={<CalendarRange className="size-4" />} tone="blue" />
            {showCrm && (
              <StatCard href="/leads?stage=SITE_VISIT" label="Site Visits Today" value={stats.siteVisitsToday} icon={<MapPin className="size-4" />} tone="indigo" glow={stats.siteVisitsToday > 0} />
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
            {showCrm && (
              <StatCard href="/leads?due=overdue" label="Overdue Follow-ups" value={followUpsOverdue.length} icon={<BellRing className="size-4" />} tone="red" glow={followUpsOverdue.length > 0} />
            )}
            {showStaffCards && (
              <>
                <StatCard href="/staff" label="Team On Job" value={stats.staffOnJobCount} icon={<HardHat className="size-4" />} tone="purple" />
                <StatCard href="/staff" label="Staff Available" value={stats.staffAvailableCount} icon={<UserCheck className="size-4" />} tone="teal" />
              </>
            )}
            {showBackOffice && (
              <>
                <StatCard href="/vehicles" label="Vehicle Available" value={stats.vehiclesActiveCount} icon={<Truck className="size-4" />} tone="indigo" />
                <StatCard href="/amc" label="Upcoming AMC" value={stats.upcomingAmcCount} icon={<ShieldCheck className="size-4" />} tone="gold" />
              </>
            )}
            {showProfit && (
              <StatCard href="/profit" label="Net Profit (month)" value={formatINR(stats.netProfit)} trend={stats.profitTrend} icon={<PiggyBank className="size-4" />} tone="green" />
            )}
          </div>
        </div>

        {/* ── Today's Action panel ────────────────────────────── */}
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
      </div>
    </div>
  );
}
