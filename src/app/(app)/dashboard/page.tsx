import Link from "next/link";
import {
  Users,
  MapPin,
  ClipboardList,
  CalendarClock,
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
  IndianRupee,
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
import { formatINR, formatDate } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening at Sahara Cleaning Services today."
      />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/leads/new">
            <Users className="size-4" />
            <span className="text-xs">New Enquiry</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/jobs">
            <ClipboardList className="size-4" />
            <span className="text-xs">New Job</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/payments">
            <IndianRupee className="size-4" />
            <span className="text-xs">New Payment</span>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Today's Jobs" value={stats.todaysJobsCount} icon={<ClipboardList className="size-4" />} tone="primary" />
        <StatCard label="Tomorrow's Jobs" value={stats.tomorrowsJobsCount} icon={<CalendarClock className="size-4" />} />
        <StatCard label="Today's Leads" value={stats.todaysLeadsCount} icon={<Users className="size-4" />} />
        <StatCard label="Site Visits Today" value={stats.siteVisitsToday} icon={<MapPin className="size-4" />} />
        <StatCard label="Pending Follow-ups" value={stats.pendingFollowUpsCount} icon={<BellRing className="size-4" />} tone="warning" />
        <StatCard
          label="Pending Advance"
          value={stats.pendingAdvanceCount}
          trendLabel={formatINR(stats.pendingAdvanceTotal)}
          icon={<Wallet className="size-4" />}
          tone="warning"
        />

        {showRevenue && (
          <>
            <StatCard
              label="Revenue Today"
              value={formatINR(stats.revenueToday)}
              icon={<TrendingUp className="size-4" />}
              tone="success"
            />
            <StatCard
              label="Collections Today"
              value={stats.collectionsTodayCount}
              trendLabel="payments"
              icon={<IndianRupee className="size-4" />}
            />
            <StatCard
              label="Pending Payments"
              value={stats.pendingPaymentsCount}
              trendLabel={formatINR(stats.pendingPaymentsTotal)}
              icon={<Wallet className="size-4" />}
              tone="warning"
            />
            <StatCard
              label="Monthly Revenue"
              value={formatINR(stats.monthlyRevenue)}
              trend={stats.revenueTrend}
              icon={<Wallet className="size-4" />}
              tone="primary"
            />
          </>
        )}
        {showProfit && (
          <StatCard
            label="Net Profit (month)"
            value={formatINR(stats.netProfit)}
            trend={stats.profitTrend}
            icon={<PiggyBank className="size-4" />}
            tone="success"
          />
        )}

        <StatCard label="Reviews Pending" value={stats.reviewsPendingCount} icon={<Star className="size-4" />} />
        <StatCard label="Team On Job" value={stats.staffOnJobCount} icon={<HardHat className="size-4" />} />
        <StatCard label="Staff Available" value={stats.staffAvailableCount} icon={<UserCheck className="size-4" />} />
        {showBackOffice && (
          <>
            <StatCard label="Vehicles Available" value={stats.vehiclesActiveCount} icon={<Truck className="size-4" />} />
            <StatCard label="Upcoming AMC (7d)" value={stats.upcomingAmcCount} icon={<ShieldCheck className="size-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <FollowUpBoard today={followUpsToday} tomorrow={followUpsTomorrow} overdue={followUpsOverdue} />
      </div>
    </div>
  );
}
